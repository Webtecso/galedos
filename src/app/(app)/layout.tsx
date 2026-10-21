import AppShell from "@/components/layout/AppShell";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ClientesProvider } from "@/components/clientes/ClientesProvider";
import { ColaboradoresProvider } from "@/components/colaboradores/ColaboradoresProvider";
import { ServicosProvider } from "@/components/servicos/ServicosProvider";
import { RemuneracoesProvider } from "@/components/remuneracoes/RemuneracoesProvider";
import { DespesasProvider } from "@/components/financas/DespesasProvider";
import { StockProvider } from "@/components/stock/StockProvider";
import { OcorrenciasProvider } from "@/components/ocorrencias/OcorrenciasProvider";
import { EmpresaProvider } from "@/components/configuracoes/EmpresaProvider";
import { DocumentosProvider } from "@/components/documentos/DocumentosProvider";
import { OrcamentosProvider } from "@/components/orcamentos/OrcamentosProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ClientesProvider>
        <ColaboradoresProvider>
          <ServicosProvider>
            <RemuneracoesProvider>
              <DespesasProvider>
                <StockProvider>
                  <OcorrenciasProvider>
                    <EmpresaProvider>
                      <DocumentosProvider>
                        <OrcamentosProvider>
                          <AppShell>{children}</AppShell>
                        </OrcamentosProvider>
                      </DocumentosProvider>
                    </EmpresaProvider>
                  </OcorrenciasProvider>
                </StockProvider>
              </DespesasProvider>
            </RemuneracoesProvider>
          </ServicosProvider>
        </ColaboradoresProvider>
      </ClientesProvider>
    </AuthProvider>
  );
}