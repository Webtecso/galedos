-- Demonstração: colaboradores, catálogo e serviços (ligam aos clientes c1..c8)
insert into public.colaboradores (id, codigo, nome, funcao, telefone, data_inicio, modalidade, contrato, percentagem, estado) values
('col1', 'COL-0001', 'Pedro Manuel', 'Técnico de limpeza', '923 100 200', '2026-01-05', 'Prestação de serviços', 'CT-001/2026', 20, 'Activo'),
('col2', 'COL-0002', 'Joana Kiala', 'Técnica de limpeza', '912 300 400', '2026-01-05', 'Prestação de serviços', 'CT-002/2026', 20, 'Activo'),
('col3', 'COL-0003', 'Domingos Neto', 'Técnico de limpeza', '934 500 600', '2026-02-10', 'Colaboração ocasional', '', 20, 'Activo'),
('col4', 'COL-0004', 'Sandra Pires', 'Técnica de limpeza', '926 700 800', '2026-03-01', 'Prestação de serviços', 'CT-004/2026', 20, 'Activo');
select setval('public.colaboradores_seq', 4);

insert into public.catalogo_servicos (id, codigo, nome, descricao, unidade, preco, duracao_min, activo) values
('cat1', 'SRV-001', 'Lavagem de sofá', 'Lavagem e higienização de sofá (por unidade).', 'unidade', 25000, 120, true),
('cat2', 'SRV-002', 'Lavagem de poltrona', 'Lavagem e higienização de poltrona.', 'unidade', 10000, 60, true),
('cat3', 'SRV-003', 'Lavagem de colchão', 'Lavagem e desinfecção de colchão.', 'unidade', 15000, 60, true),
('cat4', 'SRV-004', 'Lavagem de cadeiras estofadas', 'Lavagem de cadeiras estofadas.', 'unidade', 5000, 15, true),
('cat5', 'SRV-005', 'Limpeza de interior de viatura', 'Limpeza completa de bancos e interior.', 'viatura', 18000, 90, true),
('cat6', 'SRV-006', 'Lavagem de carpetes e tapetes', 'Cobrança por metro quadrado.', 'm²', 3500, 20, false);
select setval('public.catalogo_seq', 6);

insert into public.servicos (id, codigo, cliente_id, catalogo_id, tipo_servico, quantidade, preco_unitario, data, hora, duracao_min, local_execucao, estado_operacional, criado_em) values
('s1', 'GAL-2026-0001', 'c1', 'cat1', 'Lavagem de sofá', 1, 25000, '2026-01-15', '09:00', 120, 'Rua Direita do Miramar, 45', 'Concluído', '2026-01-15T08:00:00Z'),
('s2', 'GAL-2026-0002', 'c2', 'cat3', 'Lavagem de colchão', 6, 15000, '2026-02-01', '08:00', 360, 'Av. 4 de Fevereiro, 120', 'Concluído', '2026-02-01T08:00:00Z'),
('s3', 'GAL-2026-0003', 'c4', 'cat2', 'Lavagem de poltrona', 2, 10000, '2026-03-01', '10:00', 120, 'Rua da Samba, 8', 'Concluído', '2026-03-01T08:00:00Z'),
('s4', 'GAL-2026-0004', 'c1', 'cat1', 'Lavagem de sofá', 1, 25000, '2026-10-20', '09:00', 120, 'Rua Direita do Miramar, 45', 'Agendado', '2026-10-15T08:00:00Z'),
('s5', 'GAL-2026-0005', 'c2', 'cat3', 'Lavagem de colchão', 6, 15000, '2026-10-19', '11:30', 240, 'Av. 4 de Fevereiro, 120', 'Em execução', '2026-10-15T08:00:00Z'),
('s6', 'GAL-2026-0006', 'c3', 'cat5', 'Limpeza de interior de viatura', 1, 18000, '2026-10-20', '14:00', 90, 'Condomínio Jardins do Kilamba, Bloco C', 'Agendado', '2026-10-15T08:00:00Z'),
('s7', 'GAL-2026-0007', 'c5', 'cat4', 'Lavagem de cadeiras estofadas', 12, 5000, '2026-04-14', '09:00', 180, 'Rua Rainha Ginga, 77', 'Concluído', '2026-04-14T08:00:00Z'),
('s8', 'GAL-2026-0008', 'c7', 'cat3', 'Lavagem de colchão', 1, 15000, '2026-05-06', '15:00', 60, 'Rua Comandante Gika, 31', 'Concluído', '2026-05-06T08:00:00Z'),
('s9', 'GAL-2026-0009', 'c8', 'cat4', 'Lavagem de cadeiras estofadas', 20, 5000, '2026-06-03', '08:30', 300, 'Edifício Torres do Carmo, 5.º andar', 'Concluído', '2026-06-03T08:00:00Z');

insert into public.servico_colaboradores (servico_id, colaborador_id) values
('s1', 'col1'), ('s1', 'col2'),
('s2', 'col1'), ('s2', 'col2'),
('s3', 'col3'),
('s4', 'col1'), ('s4', 'col2'),
('s5', 'col3'), ('s5', 'col4'),
('s6', 'col1'),
('s7', 'col3'), ('s7', 'col4'),
('s8', 'col2'),
('s9', 'col1'), ('s9', 'col2'), ('s9', 'col3');

insert into public.recebimentos (id, servico_id, data, valor, meio, referencia) values
('r1', 's1', '2026-01-15', 25000, 'Dinheiro', ''),
('r2', 's2', '2026-02-01', 90000, 'Dinheiro', ''),
('r3', 's3', '2026-03-01', 20000, 'Dinheiro', ''),
('r5', 's5', '2026-10-19', 45000, 'Dinheiro', ''),
('r7', 's7', '2026-04-14', 30000, 'Dinheiro', ''),
('r8', 's8', '2026-05-06', 15000, 'Dinheiro', ''),
('r9', 's9', '2026-06-03', 100000, 'Dinheiro', '');

insert into public.contadores_servico (ano, ultimo) values (2026, 9)
on conflict (ano) do update set ultimo = excluded.ultimo;