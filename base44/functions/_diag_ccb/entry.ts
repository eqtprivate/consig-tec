// Desativado. Diagnóstico temporário de validação da CCB já concluído.
// Não lê secrets, não chama a API do Claude. Pode ser removido do repositório.
Deno.serve(() => Response.json({ error: 'gone' }, { status: 410 }));
