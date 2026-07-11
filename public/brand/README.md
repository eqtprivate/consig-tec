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

## Cores da marca

Quando definir a paleta final, registre aqui os HEX (ou HSL) para eu
centralizar no tema. O acento hoje está em **um único token** (`--primary`
em `src/index.css`), então a troca é de 1 linha:

```
Primária:   #______   (HSL ___ ___% ___%)
Secundária: #______
Acento:     #______
```

## Como subir

- Pela interface do GitHub: abra esta pasta e use **Add file → Upload files**.
- Ou me envie os arquivos por aqui que eu commito e já aplico no app.

Depois de subir, me avise para eu:
1. Trocar o placeholder “C” do Sidebar/Login pela logomarca real;
2. Ajustar o favicon; e
3. Atualizar o token de cor da marca conforme a paleta final.
