import type { Cliente, ServicoCliente } from "@/lib/types";

export const clientesMock: Cliente[] = [
  { id: "c1", codigo: "CLI-0001", nome: "Maria Fernandes", tipo: "Particular", telefone: "923 111 222", email: "maria.fernandes@email.com", endereco: "Rua Direita do Miramar, 45", localizacao: "Miramar, Luanda", nif: "", dataRegisto: "2026-01-12", observacoes: "Prefere atendimento de manhã.", estado: "Activo" },
  { id: "c2", codigo: "CLI-0002", nome: "Hotel Girassol", tipo: "Empresa", telefone: "222 333 444", email: "geral@hotelgirassol.co.ao", endereco: "Av. 4 de Fevereiro, 120", localizacao: "Ingombota, Luanda", nif: "5417001234", dataRegisto: "2026-01-20", observacoes: "Contrato mensal de colchões.", estado: "Activo" },
  { id: "c3", codigo: "CLI-0003", nome: "João Baptista", tipo: "Particular", telefone: "912 456 789", email: "", endereco: "Condomínio Jardins do Kilamba, Bloco C", localizacao: "Kilamba, Luanda", nif: "", dataRegisto: "2026-02-03", observacoes: "", estado: "Activo" },
  { id: "c4", codigo: "CLI-0004", nome: "Ana Costa", tipo: "Particular", telefone: "937 654 321", email: "ana.costa@email.com", endereco: "Rua da Samba, 8", localizacao: "Talatona, Luanda", nif: "", dataRegisto: "2026-02-18", observacoes: "Tem cão; avisar antes de chegar.", estado: "Activo" },
  { id: "c5", codigo: "CLI-0005", nome: "Clínica Vida Plena", tipo: "Empresa", telefone: "222 555 666", email: "admin@vidaplena.co.ao", endereco: "Rua Rainha Ginga, 77", localizacao: "Maianga, Luanda", nif: "5417009876", dataRegisto: "2026-03-05", observacoes: "Cadeiras de sala de espera.", estado: "Activo" },
  { id: "c6", codigo: "CLI-0006", nome: "Carlos Mendes", tipo: "Particular", telefone: "926 888 777", email: "", endereco: "Zona 5, Casa 12", localizacao: "Viana, Luanda", nif: "", dataRegisto: "2026-03-22", observacoes: "", estado: "Inactivo" },
  { id: "c7", codigo: "CLI-0007", nome: "Beatriz Lopes", tipo: "Particular", telefone: "934 222 111", email: "beatriz.lopes@email.com", endereco: "Rua Comandante Gika, 31", localizacao: "Alvalade, Luanda", nif: "", dataRegisto: "2026-04-10", observacoes: "", estado: "Activo" },
  { id: "c8", codigo: "CLI-0008", nome: "Escritório Nova Era, Lda.", tipo: "Empresa", telefone: "222 777 888", email: "contacto@novaera.co.ao", endereco: "Edifício Torres do Carmo, 5.º andar", localizacao: "Ingombota, Luanda", nif: "5417004455", dataRegisto: "2026-05-02", observacoes: "Limpeza trimestral de cadeiras.", estado: "Activo" },
];

export const servicosClienteMock: ServicoCliente[] = [
  { codigo: "GAL-2026-0001", clienteId: "c1", servico: "Lavagem de sofá (3 lugares)", data: "2026-01-15", valor: 25000, recebido: 25000, estadoOperacional: "Concluído" },
  { codigo: "GAL-2026-0004", clienteId: "c1", servico: "Lavagem de sofá (3 lugares)", data: "2026-09-10", valor: 25000, recebido: 0, estadoOperacional: "Agendado" },
  { codigo: "GAL-2026-0002", clienteId: "c2", servico: "Lavagem de colchões (x6)", data: "2026-02-01", valor: 90000, recebido: 90000, estadoOperacional: "Concluído" },
  { codigo: "GAL-2026-0005", clienteId: "c2", servico: "Lavagem de colchões (x6)", data: "2026-09-10", valor: 90000, recebido: 45000, estadoOperacional: "Em execução" },
  { codigo: "GAL-2026-0006", clienteId: "c3", servico: "Limpeza interior de viatura", data: "2026-09-10", valor: 18000, recebido: 0, estadoOperacional: "Agendado" },
  { codigo: "GAL-2026-0003", clienteId: "c4", servico: "Lavagem de poltronas (x2)", data: "2026-03-01", valor: 20000, recebido: 20000, estadoOperacional: "Concluído" },
  { codigo: "GAL-2026-0007", clienteId: "c5", servico: "Lavagem de cadeiras estofadas (x12)", data: "2026-04-14", valor: 60000, recebido: 30000, estadoOperacional: "Concluído" },
  { codigo: "GAL-2026-0008", clienteId: "c7", servico: "Lavagem de colchão (casal)", data: "2026-05-06", valor: 15000, recebido: 15000, estadoOperacional: "Concluído" },
  { codigo: "GAL-2026-0009", clienteId: "c8", servico: "Lavagem de cadeiras estofadas (x20)", data: "2026-06-03", valor: 100000, recebido: 100000, estadoOperacional: "Concluído" },
];