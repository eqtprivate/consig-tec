import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { empresasApi, planosApi } from '@/lib/api/tenant';
import { franquiasApi } from '@/lib/api/franquias';
import { usuariosApi } from '@/lib/api/usuarios';
import { auditoriaApi } from '@/lib/api/auditoria';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, MapPin, ShieldCheck, ShieldAlert, Copy, Mail, CheckCircle2, ArrowRight } from 'lucide-react';

const SEGMENTOS = ['Correspondente', 'Promotora', 'Financeira', 'Banco', 'Cooperativa', 'Securitizadora/FIDC', 'Outro'];

function Section({ n, icon: Icon, title, desc, children }) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-5">
      <div className="flex items-center gap-3 mb-4">
        <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><Icon className="w-4 h-4" /></span>
        <div>
          <p className="text-sm font-semibold text-foreground">{n}. {title}</p>
          {desc && <p className="text-[11px] text-muted-foreground">{desc}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

export default function OnboardingEmpresa() {
  const { isSuperadmin } = useAuth();
  const navigate = useNavigate();
  const [planos, setPlanos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [resultado, setResultado] = useState(null); // { empresa, senha, email, emailEnviado }

  const [emp, setEmp] = useState({ nome: '', cnpj: '', segmento: '', plano_id: '' });
  const [uni, setUni] = useState({ nome: 'Matriz', cidade: '', uf: '' });
  const [adm, setAdm] = useState({ nome: '', email: '', enviarEmail: true });

  useEffect(() => { planosApi.list().then(setPlanos).catch(() => setPlanos([])); }, []);

  if (!isSuperadmin) {
    return (
      <div className="p-12 text-center">
        <ShieldAlert className="w-8 h-8 text-amber-500 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">O onboarding de clientes é restrito a superadministradores.</p>
      </div>
    );
  }

  const podeCriar = emp.nome.trim() && emp.plano_id && adm.nome.trim() && adm.email.trim();

  const criar = async () => {
    if (!podeCriar) { toast.error('Preencha empresa (com plano) e o administrador.'); return; }
    setSaving(true);
    let empresaCriada = null;
    try {
      // 1) Empresa + plano
      empresaCriada = await empresasApi.create({
        nome: emp.nome.trim(), cnpj: emp.cnpj || null, segmento: emp.segmento || null, ativo: true,
        plano_id: emp.plano_id, plano_desde: new Date().toISOString().slice(0, 10),
      });
      await auditoriaApi.log('onboarding_empresa', 'empresas', empresaCriada.id, { nome: emp.nome });

      // 2) Primeira unidade/franquia
      if (uni.nome.trim()) {
        await franquiasApi.create({
          empresa_id: empresaCriada.id, nome: uni.nome.trim(),
          cidade: uni.cidade || null, uf: uni.uf || null, ativo: true,
        });
      }

      // 3) Admin da empresa (senha temporária, opcionalmente por e-mail)
      const novo = await usuariosApi.criar({
        nome: adm.nome.trim(), email: adm.email.trim(), role: 'admin',
        gerarSenha: true, enviarEmail: adm.enviarEmail, empresa_id: empresaCriada.id,
      });
      await auditoriaApi.log('onboarding_admin', 'usuarios', novo?.id || null, { email: adm.email, empresa_id: empresaCriada.id });

      setResultado({ empresa: empresaCriada.nome, senha: novo?.senha, email: novo?.email, emailEnviado: novo?.emailEnviado });
      toast.success('Cliente criado com sucesso.');
    } catch (err) {
      toast.error(`Falha no onboarding${empresaCriada ? ' (empresa criada, revise em Empresas & Planos)' : ''}: ${err.message || ''}`);
    } finally { setSaving(false); }
  };

  if (resultado) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <div className="bg-card rounded-xl border border-green-200 shadow-sm p-6 text-center">
          <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-foreground">Cliente {resultado.empresa} criado</h1>
          <p className="text-sm text-muted-foreground mt-1">Empresa, unidade e administrador prontos.</p>
        </div>
        <div className="bg-card rounded-xl border border-border shadow-sm p-4">
          <p className="text-xs text-muted-foreground mb-1">Senha temporária do administrador ({resultado.email})</p>
          {resultado.emailEnviado && <p className="text-xs text-green-700 flex items-center gap-1.5 mb-2"><Mail className="w-3.5 h-3.5" /> Enviada por e-mail. Guarde a cópia como backup.</p>}
          <div className="flex items-center justify-between gap-2 rounded-lg bg-muted p-3">
            <code className="font-mono text-sm text-foreground">{resultado.senha || '—'}</code>
            <button onClick={() => navigator.clipboard?.writeText(resultado.senha || '')} className="p-1.5 text-muted-foreground hover:text-foreground rounded" title="Copiar"><Copy className="w-4 h-4" /></button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">O administrador troca a senha no primeiro acesso e passa a gerenciar os próprios usuários e cadastros.</p>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => { setResultado(null); setEmp({ nome: '', cnpj: '', segmento: '', plano_id: '' }); setUni({ nome: 'Matriz', cidade: '', uf: '' }); setAdm({ nome: '', email: '', enviarEmail: true }); }}>Novo cliente</Button>
          <Button onClick={() => navigate('/admin/empresas')} className="gap-2">Ir para Empresas & Planos <ArrowRight className="w-4 h-4" /></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Onboarding de cliente</h1>
        <p className="text-sm text-muted-foreground mt-1">Cria a empresa-cliente, o plano, a primeira unidade e o administrador — em um passo.</p>
      </div>

      <Section n={1} icon={Building2} title="Empresa (tenant)" desc="Dados do cliente e o plano de acesso contratado.">
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Nome</Label><Input value={emp.nome} onChange={(e) => setEmp({ ...emp, nome: e.target.value })} placeholder="Ex.: Crédito Popular LTDA" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5 sm:col-span-1"><Label>CNPJ</Label><Input value={emp.cnpj} onChange={(e) => setEmp({ ...emp, cnpj: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>Segmento</Label>
              <Select value={emp.segmento} onValueChange={(v) => setEmp({ ...emp, segmento: v })}>
                <SelectTrigger><SelectValue placeholder="Classificação" /></SelectTrigger>
                <SelectContent>{SEGMENTOS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Plano</Label>
              <Select value={emp.plano_id} onValueChange={(v) => setEmp({ ...emp, plano_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>{planos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </Section>

      <Section n={2} icon={MapPin} title="Primeira unidade" desc="A franquia/unidade inicial do cliente (pode adicionar mais depois).">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5 sm:col-span-1"><Label>Nome</Label><Input value={uni.nome} onChange={(e) => setUni({ ...uni, nome: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Cidade</Label><Input value={uni.cidade} onChange={(e) => setUni({ ...uni, cidade: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>UF</Label><Input maxLength={2} value={uni.uf} onChange={(e) => setUni({ ...uni, uf: e.target.value.toUpperCase() })} /></div>
        </div>
      </Section>

      <Section n={3} icon={ShieldCheck} title="Administrador da empresa" desc="Recebe senha temporária e passa a gerenciar o próprio tenant.">
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Nome</Label><Input value={adm.nome} onChange={(e) => setAdm({ ...adm, nome: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>E-mail</Label><Input type="email" value={adm.email} onChange={(e) => setAdm({ ...adm, email: e.target.value })} /></div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <Label htmlFor="ob-email" className="cursor-pointer flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" /> Enviar senha por e-mail</Label>
            <Switch id="ob-email" checked={adm.enviarEmail} onCheckedChange={(v) => setAdm({ ...adm, enviarEmail: v })} />
          </div>
        </div>
      </Section>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate('/admin/empresas')}>Cancelar</Button>
        <Button onClick={criar} disabled={saving || !podeCriar} className="gap-2">
          {saving ? 'Criando…' : 'Criar cliente'} <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
