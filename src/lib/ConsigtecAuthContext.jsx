import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase, initSupabase } from '@/lib/supabaseClient';

const ConsigtecAuthContext = createContext();

export const ConsigtecAuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [vinculos, setVinculos] = useState([]);
  const [empresa, setEmpresa] = useState(null);
  const [planoUso, setPlanoUso] = useState(null);
  const [activeUnidade, setActiveUnidade] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUserData = useCallback(async (authUser) => {
    const { data: perfilData } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', authUser.id)
      .single();

    setPerfil(perfilData);

    if (perfilData) {
      const { data: vinculosData } = await supabase
        .from('vinculos')
        .select('*, empresa:empresas(*), franquia:franquias(*), area:areas(*), papel:papeis(*)')
        .eq('usuario_id', perfilData.id)
        .eq('ativo', true);

      setVinculos(vinculosData || []);

      // Empresa (tenant) + plano + uso — multi-tenant / planos de acesso.
      if (perfilData.empresa_id) {
        const { data: empresaData } = await supabase
          .from('empresas').select('*, plano:planos(*)').eq('id', perfilData.empresa_id).maybeSingle();
        setEmpresa(empresaData || null);
      } else {
        setEmpresa(null);
      }
      supabase.rpc('plano_uso_empresa').then(({ data }) => setPlanoUso(data || null)).catch(() => setPlanoUso(null));

      const franquiasMap = new Map();
      (vinculosData || []).forEach((v) => {
        if (v.franquia) franquiasMap.set(v.franquia.id, v.franquia);
      });
      const uniqueFranquias = [...franquiasMap.values()];

      const savedId = localStorage.getItem('consigtec_active_unidade');
      const found = savedId ? uniqueFranquias.find((u) => u.id === savedId) : null;
      setActiveUnidade(found || uniqueFranquias[0] || null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    let subscription;

    const init = async () => {
      try {
        await initSupabase();
      } catch (e) {
        console.error('Erro ao inicializar Supabase:', e);
        setLoading(false);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(session);
      if (session) await loadUserData(session.user);
      setLoading(false);

      const { data } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
        if (!mounted) return;
        setSession(newSession);
        if (newSession) {
          await loadUserData(newSession.user);
        } else {
          setPerfil(null);
          setVinculos([]);
          setActiveUnidade(null);
          setEmpresa(null);
          setPlanoUso(null);
        }
        setLoading(false);
      });
      subscription = data.subscription;
    };

    init();

    return () => {
      mounted = false;
      if (subscription) subscription.unsubscribe();
    };
  }, [loadUserData]);

  const switchUnidade = (unidade) => {
    setActiveUnidade(unidade);
    localStorage.setItem('consigtec_active_unidade', unidade.id);
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

  return (
    <ConsigtecAuthContext.Provider value={{
      session,
      perfil,
      vinculos,
      empresa,
      plano: empresa?.plano || null,
      planoUso,
      modulos,
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