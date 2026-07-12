-- ============================================================
-- CONSIGTEC — SEED DE DEMONSTRAÇÃO (não é migração).
-- Popula tomadores (clientes) + matrículas com margem apartada para os
-- convênios da carga PixConsig, fazendo a "Capacidade por Município" acender.
-- Seguro para reexecutar: só semeia convênio que ainda não tenha matrícula.
-- Para REMOVER a simulação, veja o bloco no final (comentado).
-- ============================================================

DO $$
DECLARE
  c            RECORD;
  n_tom        int;
  i            int;
  v_cli        uuid;
  v_cpf        text;
  v_nasc       date;
  v_sal        numeric;
  v_pct        numeric;
  v_marg       numeric;
  v_sit        situacao_matricula;
  v_nome       text;
  nomes        text[] := ARRAY['Maria','José','Ana','João','Francisca','Antônio','Adriana','Carlos',
                               'Juliana','Paulo','Fernanda','Marcos','Patrícia','Rafael','Sandra','Luiz',
                               'Camila','Pedro','Aline','Bruno','Vanessa','Rodrigo','Débora','Felipe'];
  sobren       text[] := ARRAY['Silva','Santos','Oliveira','Souza','Lima','Pereira','Costa','Rodrigues',
                               'Almeida','Nascimento','Ferreira','Gomes','Martins','Araújo','Ribeiro','Carvalho'];
BEGIN
  FOR c IN
    SELECT id, nome, COALESCE(percentual_margem_apartada, 10) AS pct
    FROM convenios
    WHERE pixconsig_convenio_id LIKE 'PIX-CONV-%'
  LOOP
    -- só semeia se o convênio ainda não tem matrículas (idempotência)
    IF EXISTS (SELECT 1 FROM matriculas m WHERE m.convenio_id = c.id) THEN
      CONTINUE;
    END IF;

    n_tom := 8 + floor(random() * 15)::int;   -- 8 a 22 tomadores por município
    v_pct := c.pct;

    FOR i IN 1..n_tom LOOP
      -- CPF sintético único (11 dígitos); pula colisão eventual
      v_cpf := lpad(((floor(random() * 89999999999) + 10000000000))::bigint::text, 11, '0');
      CONTINUE WHEN EXISTS (SELECT 1 FROM clientes WHERE cpf = v_cpf);

      v_nome := nomes[1 + floor(random() * array_length(nomes, 1))::int] || ' '
             || sobren[1 + floor(random() * array_length(sobren, 1))::int] || ' '
             || sobren[1 + floor(random() * array_length(sobren, 1))::int];

      -- idade 24 a 74 anos
      v_nasc := (current_date - ((24 * 365) + floor(random() * (50 * 365))::int));

      -- situação: maioria ativo; parte aposentado/pensionista
      v_sit := (ARRAY['ativo','ativo','ativo','aposentado','pensionista'])[1 + floor(random() * 5)::int]::situacao_matricula;

      v_sal  := round((1800 + floor(random() * 4200))::numeric, 2);        -- 1.800 a 6.000
      v_marg := round(v_sal * v_pct / 100.0, 2);                            -- margem apartada bruta

      INSERT INTO clientes (cpf, nome, data_nascimento, telefone, convenio_id, ativo)
      VALUES (
        v_cpf, v_nome, v_nasc,
        '(' || (11 + floor(random() * 88))::int || ') 9' || lpad(floor(random() * 99999999)::int::text, 8, '0'),
        c.id, true
      )
      RETURNING id INTO v_cli;

      INSERT INTO matriculas (cliente_id, convenio_id, matricula, orgao, cargo, situacao,
                              data_admissao, salario_bruto, margem_bruta, margem_utilizada, ativo)
      VALUES (
        v_cli, c.id,
        'MAT-' || lpad(floor(random() * 999999)::int::text, 6, '0'),
        c.nome, 'Servidor Municipal', v_sit,
        (current_date - floor(random() * 4000)::int),
        v_sal, v_marg, 0, true
      );
    END LOOP;

    RAISE NOTICE 'Semeados % tomadores para % ', n_tom, c.nome;
  END LOOP;
END $$;

-- Conferência rápida da capacidade após o seed:
-- SELECT cidade, uf, tomadores, vinculos_elegiveis, margem_disponivel
-- FROM capacidade_por_convenio() ORDER BY margem_disponivel DESC;

-- ------------------------------------------------------------
-- PARA REMOVER a simulação (apaga clientes/matrículas dos convênios PixConsig).
-- Descomente e rode com cuidado — remove TODOS os tomadores desses convênios.
-- ------------------------------------------------------------
-- DELETE FROM clientes
--  WHERE convenio_id IN (SELECT id FROM convenios WHERE pixconsig_convenio_id LIKE 'PIX-CONV-%');
