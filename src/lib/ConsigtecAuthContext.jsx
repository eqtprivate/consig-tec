import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase, initSupabase } from '@/lib/supabaseClient';
import { empresasApi } from '@/lib/api/tenant';
import { getEmpresaView, setEmpresaViewStore, setFranquiasViewStore } from '@/lib/tenantView';
import { applyBranding } from '@/lib/branding';

const ConsigtecAuthContext = createContext();

export const ConsigtecAuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [vinculos, setVinculos] = useState([]);
  const [empresa, setEmpresa] = useState(null);
  const [planoUso, setPlanoUso] = useState(null);
  const [empresasSuperadmin, setEmpresasSuperadmin] = useState([]);
  const [empresaView, setEmpresaViewState] = useState(getEmpresaView());
  const [activeUnidade, setActiveUnidade] = useState(null);
  const [loading, setLoading] = useState(true);

  // Carrega perfil/vínculos/empresa do usuário logado. NUNCA lança: cada consulta
  // é isolada, então uma falha pontual (RLS, rede, embed) degrada o dado afetado
  // sem travar o app. Quem chama garante setLoading(false) via finally.
  const loadUserData = useCallback(async (authUser) => {
    try {
      const { data: perfilData, error: perfilErr } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (perfilErr) console.error('Erro ao carregar perfil:', perfilErr);
      setPerfil(perfilData || null);
      if (!perfilData) return;

      // Vínculos (embed de franquia/area/papel). Se o embed falhar, seguimos
      // com lista vazia — nunca deixamos a falha propagar e travar o login.
      let vinculosData = [];
      try {
        const { data, error } = await supabase
          .from('vinculos')
          .select('*, empresa:empresas(*), franquia:franquias(*), area:areas(*), papel:papeis(*)')
          .eq('usuario_id', perfilData.id)
          .eq('ativo', true);
        if (error) console.error('Erro ao carregar vínculos:', error);
        vinculosData = data || [];
      } catch (e) {
        console.error('Falha ao carregar vínculos:', e);
      }
      setVinculos(vinculosData);

      // Empresa (tenant) + plano + uso — multi-tenant / planos de acesso.
      if (perfilData.empresa_id) {
        try {
          const { data: empresaData } = await supabase
            .from('empresas').select('*, plano:planos(*)').eq('id', perfilData.empresa_id).maybeSingle();
          setEmpresa(empresaData || null);
        } catch (e) {
          console.error('Falha ao carregar empresa:', e);
          setEmpresa(null);
        }
      } else {
        setEmpresa(null);
      }
      supabase.rpc('plano_uso_empresa').then(({ data }) => setPlanoUso(data || null)).catch(() => setPlanoUso(null));

      // Superadmin: lista de empresas para o switcher "ver como".
      if (perfilData.role === 'superadmin') {
        empresasApi.list().then(setEmpresasSuperadmin).catch(() => setEmpresasSuperadmin([]));
      }

      const franquiasMap = new Map();
      vinculosData.forEach((v) => {
        if (v.franquia) franquiasMap.set(v.franquia.id, v.franquia);
      });
      const uniqueFranquias = [...franquiasMap.values()];

      let savedId = null;
      try { savedId = localStorage.getItem('consigtec_active_unidade'); } catch { /* ignore */ }
      const found = savedId ? uniqueFranquias.find((u) => u.id === savedId) : null;
      setActiveUnidade(found || uniqueFranquias[0] || null);
    } catch (e) {
      // Blindagem final: qualquer erro inesperado não pode travar o app no spinner.
      console.error('Erro inesperado ao carregar dados do usuário:', e);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    let subscription;

    // Rede de segurança: se a inicialização travar (rede/backend fora do ar),
    // liberamos o spinner assim mesmo — o usuário cai no /login em vez de ficar
    // preso em "carregando" indefinidamente.
    const failSafe = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 15000);

    const init = async () => {
      try {
        await initSupabase();

        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        setSession(session);
        if (session) await loadUserData(session.user);

        const { data } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
          if (!mounted) return;
          setSession(newSession);
          try {
            if (newSession) {
              await loadUserData(newSession.user);
            } else {
              setPerfil(null);
              setVinculos([]);
              setActiveUnidade(null);
              setEmpresa(null);
              setPlanoUso(null);
            }
          } finally {
            if (mounted) setLoading(false);
          }
        });
        subscription = data.subscription;
      } catch (e) {
        console.error('Erro ao inicializar autenticação:', e);
      } finally {
        // Independentemente de sucesso/erro, nunca deixamos o app preso no spinner.
        if (mounted) setLoading(false);
        clearTimeout(failSafe);
      }
    };

    init();

    return () => {
      mounted = false;
      clearTimeout(failSafe);
      if (subscription) subscription.unsubscribe();
    };
  }, [loadUserData]);

  const switchUnidade = (unidade) => {
    setActiveUnidade(unidade);
    localStorage.setItem('consigtec_active_unidade', unidade.id);
  };

  // "Ver como" empresa (superadmin). Persiste e recarrega para as listas
  // reaplicarem o filtro de empresa de forma consistente em todas as telas.
  // (Todas as tabelas operacionais já filtram por empresa_id — não há mais
  // filtro por franquia a resolver.)
  const setEmpresaView = (id) => {
    setEmpresaViewStore(id || null);
    setEmpresaViewState(id || null);
    setFranquiasViewStore(null);
    window.location.reload();
  };

  const logout = async () => {
    localStorage.removeItem('consigtec_active_unidade');
    await supabase.auth.signOut();
  };

  // isAdmin/isSuperadmin baseados APENAS em role, para o cliente refletir
  // exatamente o que o banco (RLS via auth_is_grupo_admin/superadmin) permite.
  const isSuperadmin = perfil?.role === 'superadmin';
  const isAdmin = ['admin', 'superadmin'].includes(perfil?.role);

  const availableAreas = (() => {
    if (!activeUnidade) return [];
    const areas = vinculos
      .filter((v) => v.franquia_id === activeUnidade.id)
      .map((v) => v.area)
      .filter(Boolean);
    return [...new Map(areas.map((a) => [a.id, a])).values()];
  })();

  // Módulos liberados pelo plano da empresa ('*' = todos; sem plano = não bloqueia).
  const modulos = empresa?.plano?.modulos || null;
  const moduloLiberado = (areaCodigo) => {
    if (isSuperadmin) return true;               // superadmin transita tudo
    if (!modulos) return true;                   // empresa sem plano definido não bloqueia
    return modulos.includes('*') || modulos.includes(areaCodigo);
  };

  const hasAreaAccess = (areaCodigo) => {
    if (isSuperadmin) return true;
    if (areaCodigo === 'admin') return isAdmin;  // console de gestão sempre p/ admin da empresa
    if (!moduloLiberado(areaCodigo)) return false; // plano não inclui o módulo
    if (isAdmin) return true;                    // admin vê todos os módulos do plano
    return availableAreas.some((a) => a.codigo === areaCodigo);
  };

  const uniqueUnidades = (() => {
    const map = new Map();
    vinculos.forEach((v) => { if (v.franquia) map.set(v.franquia.id, v.franquia); });
    return [...map.values()];
  })();

  // Branding efetivo (white-label): superadmin "ver como" usa a empresa em foco;
  // demais usuários usam a própria empresa. Aplica a cor primária no <html>.
  const brandEmpresa = (isSuperadmin && empresaView)
    ? (empresasSuperadmin.find((e) => e.id === empresaView) || null)
    : empresa;
  const brand = brandEmpresa
    ? {
        empresa_id: brandEmpresa.id, nome: brandEmpresa.nome,
        tema: brandEmpresa.tema || null,
        cor_primaria: brandEmpresa.cor_primaria || null,
        logo_url: brandEmpresa.logo_url || null,
        logo_url_dark: brandEmpresa.logo_url_dark || null,
      }
    : null;
  const menuConfig = brandEmpresa?.menu_config || null; // config do menu da empresa efetiva
  useEffect(() => {
    try {
      applyBranding({ tema: brand?.tema, cor_primaria: brand?.cor_primaria });
    } catch (e) {
      console.error('Falha ao aplicar branding:', e);
    }
  }, [brand?.tema, brand?.cor_primaria]);

  return (
    <ConsigtecAuthContext.Provider value={{
      session,
      perfil,
      vinculos,
      empresa,
      brand,
      menuConfig,
      plano: empresa?.plano || null,
      planoUso,
      modulos,
      empresasSuperadmin,
      empresaView,
      setEmpresaView,
      activeUnidade,
      uniqueUnidades,
      availableAreas,
      isAdmin,
      isSuperadmin,
      loading,
      isAuthenticated: !!session,
      switchUnidade,
      logout,
      hasAreaAccess,
      moduloLiberado,
      reloadUserData: () => session?.user && loadUserData(session.user),
    }}>
      {children}
    </ConsigtecAuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(ConsigtecAuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de ConsigtecAuthProvider');
  return ctx;
};