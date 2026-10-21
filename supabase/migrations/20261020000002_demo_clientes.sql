-- Clientes de demonstração (ids c1..c8 ligam às ordens de serviço de demonstração ainda locais)
insert into public.clientes (id, codigo, nome, tipo, telefone, email, endereco, localizacao, nif, data_registo, observacoes, estado) values
('c1', 'CLI-0001', 'Maria Fernandes', 'Particular', '923 111 222', 'maria.fernandes@email.com', 'Rua Direita do Miramar, 45', 'Miramar, Luanda', '', '2026-01-12', 'Prefere atendimento de manhã.', 'Activo'),
('c2', 'CLI-0002', 'Hotel Girassol', 'Empresa', '222 333 444', 'geral@hotelgirassol.co.ao', 'Av. 4 de Fevereiro, 120', 'Ingombota, Luanda', '5417001234', '2026-01-20', 'Contrato mensal de colchões.', 'Activo'),
('c3', 'CLI-0003', 'João Baptista', 'Particular', '912 456 789', '', 'Condomínio Jardins do Kilamba, Bloco C', 'Kilamba, Luanda', '', '2026-02-03', '', 'Activo'),
('c4', 'CLI-0004', 'Ana Costa', 'Particular', '937 654 321', 'ana.costa@email.com', 'Rua da Samba, 8', 'Talatona, Luanda', '', '2026-02-18', 'Tem cão; avisar antes de chegar.', 'Activo'),
('c5', 'CLI-0005', 'Clínica Vida Plena', 'Empresa', '222 555 666', 'admin@vidaplena.co.ao', 'Rua Rainha Ginga, 77', 'Maianga, Luanda', '5417009876', '2026-03-05', 'Cadeiras de sala de espera.', 'Activo'),
('c6', 'CLI-0006', 'Carlos Mendes', 'Particular', '926 888 777', '', 'Zona 5, Casa 12', 'Viana, Luanda', '', '2026-03-22', '', 'Inactivo'),
('c7', 'CLI-0007', 'Beatriz Lopes', 'Particular', '934 222 111', 'beatriz.lopes@email.com', 'Rua Comandante Gika, 31', 'Alvalade, Luanda', '', '2026-04-10', '', 'Activo'),
('c8', 'CLI-0008', 'Escritório Nova Era, Lda.', 'Empresa', '222 777 888', 'contacto@novaera.co.ao', 'Edifício Torres do Carmo, 5.º andar', 'Ingombota, Luanda', '5417004455', '2026-05-02', 'Limpeza trimestral de cadeiras.', 'Activo');

select setval('public.clientes_seq', 8);