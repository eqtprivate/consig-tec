import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase, initSupabase } from '@/lib/supabaseClient';

const ConsigtecAuthContext = createContext();

export const ConsigtecAuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [vinculos, setVinculos] = useState([]);
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

  const isSuperadmin = perfil?.role === 'superadmin';
  const isAdmin = ['admin', 'superadmin'].includes(perfil?.role)
    || !!perfil?.is_grupo_admin
    || vinculos.some((v) => v.papel?.codigo?.startsWith('admin'));

  const availableAreas = (() => {
    if (!activeUnidade) return [];
    const areas = vinculos
      .filter((v) => v.franquia_id === activeUnidade.id)
      .map((v) => v.area)
      .filter(Boolean);
    return [...new Map(areas.map((a) => [a.id, a])).values()];
  })();

  const hasAreaAccess = (areaCodigo) => {
    if (isAdmin) return true;
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