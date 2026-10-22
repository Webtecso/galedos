-- Dados de demonstração: stock e equipamentos (podem ser apagados antes de entrar em produção)

insert into public.produtos (nome, categoria, unidade, quantidade, minimo, fornecedor, custo, ultima_entrada) values
  ('Detergente para estofados', 'Detergentes', 'litro', 3, 5, 'Casa da Química', 1400, '2026-10-02'),
  ('Desinfectante para colchões', 'Desinfectantes', 'litro', 12, 4, 'Casa da Química', 1800, '2026-09-20'),
  ('Escovas de limpeza', 'Escovas e panos', 'unidade', 8, 3, '', 900, '2026-08-15'),
  ('Panos de microfibra', 'Escovas e panos', 'unidade', 25, 10, '', 350, '2026-08-15');

insert into public.movimentos_stock (produto_id, tipo, variacao, saldo_apos, data, responsavel, motivo)
select id, 'Entrada por compra', quantidade, quantidade, ultima_entrada, 'Sistema', 'Stock inicial (demonstração)'
from public.produtos;

insert into public.equipamentos (nome, categoria, estado, data_aquisicao, observacoes) values
  ('Aspirador industrial', 'Aspirador', 'Operacional', '2026-01-10', ''),
  ('Máquina de extracção', 'Máquina de extracção', 'Em manutenção', '2026-01-10', 'Reparação da bomba.'),
  ('Máquina de lavagem de colchões', 'Máquina de lavagem', 'Operacional', '2026-02-20', '');

insert into public.manutencoes_equipamento (equipamento_id, data, descricao, custo, utilizador_nome)
select id, '2026-10-14', 'Reparação da bomba de água', 22000, 'Sistema'
from public.equipamentos where nome = 'Máquina de extracção';

insert into public.equipamento_historico (equipamento_id, utilizador_nome, accao)
select id, 'Sistema', 'Equipamento registado (demonstração)' from public.equipamentos;