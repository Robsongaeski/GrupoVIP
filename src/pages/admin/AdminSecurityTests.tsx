import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Play,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Clock,
} from "lucide-react";

interface TestResult {
  table: string;
  test: string;
  passed: boolean;
  message: string;
  severity: "critical" | "warning" | "info";
}

interface SecurityReport {
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  criticalFailures: number;
  results: TestResult[];
}

export default function AdminSecurityTests() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<SecurityReport | null>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const runSecurityTests = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("security-tests");

      if (error) throw error;

      setReport(data);
      setLastRun(new Date().toLocaleString("pt-BR"));

      if (data.criticalFailures > 0) {
        toast.error(`${data.criticalFailures} falha(s) crítica(s) detectada(s)!`);
      } else if (data.failed > 0) {
        toast.warning(`${data.failed} teste(s) falhou(aram)`);
      } else {
        toast.success("Todos os testes passaram!");
      }
    } catch (error: any) {
      console.error("Error running security tests:", error);
      toast.error(error.message || "Erro ao executar testes de segurança");
    } finally {
      setRunning(false);
    }
  };

  const getSeverityBadge = (severity: string, passed: boolean) => {
    if (passed) {
      return (
        <Badge variant="default" className="bg-green-500">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Passou
        </Badge>
      );
    }

    switch (severity) {
      case "critical":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Crítico
          </Badge>
        );
      case "warning":
        return (
          <Badge variant="secondary" className="bg-amber-500 text-white">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Aviso
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <Info className="h-3 w-3 mr-1" />
            Info
          </Badge>
        );
    }
  };

  const getOverallStatus = () => {
    if (!report) return null;

    if (report.criticalFailures > 0) {
      return {
        icon: ShieldX,
        label: "Vulnerável",
        color: "text-destructive",
        bgColor: "bg-destructive/10",
      };
    }

    if (report.failed > 0) {
      return {
        icon: ShieldAlert,
        label: "Atenção Necessária",
        color: "text-amber-500",
        bgColor: "bg-amber-500/10",
      };
    }

    return {
      icon: ShieldCheck,
      label: "Seguro",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    };
  };

  const status = getOverallStatus();

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="h-8 w-8 text-primary" />
              Testes de Segurança
            </h1>
            <p className="text-muted-foreground">
              Verificação automatizada de isolamento de dados entre usuários
            </p>
          </div>
          <Button onClick={runSecurityTests} disabled={running} size="lg">
            {running ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Executando...
              </>
            ) : (
              <>
                <Play className="mr-2 h-5 w-5" />
                Executar Testes
              </>
            )}
          </Button>
        </div>

        {/* Status Overview */}
        {report && status && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card className={status.bgColor}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <status.icon className={`h-10 w-10 ${status.color}`} />
                  <div>
                    <p className="text-sm text-muted-foreground">Status Geral</p>
                    <p className={`text-2xl font-bold ${status.color}`}>{status.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Testes Passou</p>
                    <p className="text-2xl font-bold text-green-500">{report.passed}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <XCircle className="h-10 w-10 text-destructive" />
                  <div>
                    <p className="text-sm text-muted-foreground">Testes Falhou</p>
                    <p className="text-2xl font-bold text-destructive">{report.failed}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Clock className="h-10 w-10 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Última Execução</p>
                    <p className="text-sm font-medium">{lastRun}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Progress */}
        {report && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Taxa de Sucesso</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{report.passed} de {report.totalTests} testes passaram</span>
                  <span className="font-medium">
                    {Math.round((report.passed / report.totalTests) * 100)}%
                  </span>
                </div>
                <Progress
                  value={(report.passed / report.totalTests) * 100}
                  className="h-3"
                  indicatorClassName={
                    report.criticalFailures > 0
                      ? "bg-destructive"
                      : report.failed > 0
                      ? "bg-amber-500"
                      : "bg-green-500"
                  }
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Test Results Table */}
        {report && (
          <Card>
            <CardHeader>
              <CardTitle>Resultados Detalhados</CardTitle>
              <CardDescription>
                Verificação de RLS (Row Level Security) por tabela
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tabela</TableHead>
                    <TableHead>Teste</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Mensagem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.results.map((result, index) => (
                    <TableRow
                      key={index}
                      className={
                        !result.passed && result.severity === "critical"
                          ? "bg-destructive/5"
                          : ""
                      }
                    >
                      <TableCell className="font-mono text-sm">{result.table}</TableCell>
                      <TableCell>{result.test}</TableCell>
                      <TableCell>{getSeverityBadge(result.severity, result.passed)}</TableCell>
                      <TableCell className="max-w-md">
                        <p className="text-sm text-muted-foreground truncate" title={result.message}>
                          {result.message}
                        </p>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!report && !running && (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="p-4 bg-muted rounded-full mb-4">
                  <Shield className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Nenhum teste executado</h3>
                <p className="text-muted-foreground mb-6 max-w-md">
                  Execute os testes de segurança para verificar se as políticas RLS estão funcionando
                  corretamente e isolando os dados entre usuários.
                </p>
                <Button onClick={runSecurityTests} size="lg">
                  <Play className="mr-2 h-5 w-5" />
                  Executar Testes
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              Sobre os Testes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Os testes de segurança verificam se as políticas de Row Level Security (RLS) do
              Supabase estão funcionando corretamente para isolar os dados entre usuários.
            </p>
            <p>
              <strong>O que é testado:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Isolamento de instâncias WhatsApp entre usuários</li>
              <li>Isolamento de grupos entre usuários</li>
              <li>Isolamento de campanhas entre usuários</li>
              <li>Isolamento de links inteligentes entre usuários</li>
              <li>Isolamento de ações em grupo entre usuários</li>
              <li>Isolamento de assinaturas e pagamentos</li>
              <li>Proteção de dados pessoais (perfis)</li>
              <li>Proteção de logs de atividade</li>
              <li>Proteção de tabelas administrativas</li>
              <li>Prevenção de inserção de dados para outros usuários</li>
            </ul>
            <p className="pt-2">
              <strong>Níveis de severidade:</strong>
            </p>
            <ul className="space-y-1 ml-2">
              <li className="flex items-center gap-2">
                <Badge variant="destructive" className="text-xs">Crítico</Badge>
                <span>Vulnerabilidade grave que permite acesso não autorizado</span>
              </li>
              <li className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-amber-500 text-white text-xs">Aviso</Badge>
                <span>Potencial problema que deve ser investigado</span>
              </li>
              <li className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">Info</Badge>
                <span>Informativo, não representa risco</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
