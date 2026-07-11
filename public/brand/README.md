# CONSIGTEC — Marca / Logomarca

Coloque aqui os arquivos da identidade visual da CONSIGTEC. Tudo nesta pasta
é servido estaticamente pelo app em `/brand/...` (ex.: `/brand/logo.svg`),
então pode ser referenciado direto no código (Sidebar, Login, favicon).

## Arquivos esperados (sugestão de nomes)

| Arquivo | Uso |
|---|---|
| `logo.svg` | Logomarca principal (horizontal), vetorial — preferencial |
| `logo.png` | Versão PNG fundo transparente (fallback / e-mails) |
| `logo-mono-branco.svg` | Versão monocromática branca (fundos escuros / sidebar dark) |
| `logo-mono-escuro.svg` | Versão monocromática escura (fundos claros) |
| `simbolo.svg` | Apenas o símbolo/ícone (sem texto) — para espaços pequenos |
| `favicon.svg` / `favicon.png` | Ícone da aba do navegador (32×32 e 180×180) |
| `marca.pdf` | Manual de marca / arquivo original do designer (referência) |

## Cores da marca (aplicadas)

| Cor | HEX | HSL | Uso no app |
|---|---|---|---|
| Navy | `#2E4053` | `211 30% 24%` | wordmark, ação primária (claro), fundo do Login |
| Verde | `#8CC152` | `89 47% 54%` | símbolo, foco/ring, destaques, ação primária (escuro) |

Tokens em `src/index.css`: `--brand-navy`, `--brand-green`, `--primary`,
`--ring`, `--sidebar-primary`. No tema **claro** o acento interativo é o
navy (legível em fundo claro); no **escuro**, o verde (destaca no fundo
escuro). O verde é o foco/ring nos dois.

## Arquivos aplicados
- Sidebar: `consigtec_logo_white.png` (claro) / `consigtec_logo_dark.png` (escuro)
- Login: `consigtec_logo_dark.png` (sobre gradiente navy)
- Favicon: `consigtec_logo_icon.png`

## Como subir

- Pela interface do GitHub: abra esta pasta e use **Add file → Upload files**.
- Ou me envie os arquivos por aqui que eu commito e já aplico no app.

Depois de subir, me avise para eu:
1. Trocar o placeholder “C” do Sidebar/Login pela logomarca real;
2. Ajustar o favicon; e
3. Atualizar o token de cor da marca conforme a paleta final.
