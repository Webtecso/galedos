insert into public.despesas (id, codigo, data, categoria, descricao, valor, fornecedor, meio, referencia, estado) values
('d1', 'DSP-0001', '2026-10-02', 'Produtos de limpeza', 'Detergente para estofados (20 L)', 28000, 'Casa da Química', 'Dinheiro', '', 'Pago'),
('d2', 'DSP-0002', '2026-10-05', 'Combustível', 'Combustível da carrinha', 15000, '', 'Dinheiro', '', 'Pago'),
('d3', 'DSP-0003', '2026-10-09', 'Transporte', 'Táxi para entrega de equipamento', 4500, '', 'Dinheiro', '', 'Pago'),
('d4', 'DSP-0004', '2026-10-14', 'Manutenção', 'Reparação da máquina de extracção', 22000, 'Oficina Técnica Luanda', 'Dinheiro', '', 'Por pagar'),
('d5', 'DSP-0005', '2026-09-18', 'Comunicações', 'Saldo de dados móveis', 6000, '', 'Dinheiro', '', 'Pago');
select setval('public.despesas_seq', 5);