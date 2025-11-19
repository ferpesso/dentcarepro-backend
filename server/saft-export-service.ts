import { getDb } from "./db";
import { faturas, itensFatura, utentes, clinicas } from "../drizzle/schema";
import { eq, and, gte, lte } from "drizzle-orm";

/**
 * Servico de Exportacao SAF-T PT
 * Standard Audit File for Tax Purposes - Portugal
 * 
 * Formato XML obrigatorio para comunicacao com a Autoridade Tributaria
 * Usado pelos contabilistas para declaracoes fiscais
 */

interface SAFTExportOptions {
  clinicaId: number;
  dataInicio: Date;
  dataFim: Date;
  tipoDocumento?: "FT" | "FS" | "FR" | "NC" | "ND"; // Fatura, Fatura Simplificada, Fatura Recibo, Nota Credito, Nota Debito
}

export class SAFTExportService {
  /**
   * Exportar dados no formato SAF-T PT (XML)
   */
  static async exportarSAFT(options: SAFTExportOptions): Promise<string> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Obter dados da clinica
    const [clinica] = await db
      .select()
      .from(clinicas)
      .where(eq(clinicas.id, options.clinicaId));

    if (!clinica) throw new Error("Clinica not found");

    // Obter faturas do periodo
    const faturasData = await db
      .select()
      .from(faturas)
      .leftJoin(utentes, eq(faturas.utenteId, utentes.id))
      .where(
        and(
          eq(faturas.clinicaId, options.clinicaId),
          gte(faturas.dataFatura, options.dataInicio),
          lte(faturas.dataFatura, options.dataFim)
        )
      );

    // Obter itens de todas as faturas
    const faturasIds = faturasData.map(f => f.faturas.id);
    const itens = faturasIds.length > 0 
      ? await db
          .select()
          .from(itensFatura)
          .where(eq(itensFatura.faturaId, faturasIds[0])) // Simplificado
      : [];

    // Gerar XML SAF-T PT
    const xml = this.gerarXMLSAFT(clinica, faturasData, itens, options);

    return xml;
  }

  /**
   * Gerar XML no formato SAF-T PT
   */
  private static gerarXMLSAFT(
    clinica: any,
    faturas: any[],
    itens: any[],
    options: SAFTExportOptions
  ): string {
    const dataExportacao = new Date().toISOString();
    
    // Header
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:PT_1.04_01">\n';
    
    // Header
    xml += '  <Header>\n';
    xml += `    <AuditFileVersion>1.04_01</AuditFileVersion>\n`;
    xml += `    <CompanyID>${clinica.nif || 'N/A'}</CompanyID>\n`;
    xml += `    <TaxRegistrationNumber>${clinica.nif || 'N/A'}</TaxRegistrationNumber>\n`;
    xml += `    <TaxAccountingBasis>F</TaxAccountingBasis>\n`; // F = Faturacao
    xml += `    <CompanyName>${this.escapeXML(clinica.nome)}</CompanyName>\n`;
    xml += `    <CompanyAddress>\n`;
    xml += `      <AddressDetail>${this.escapeXML(clinica.morada || '')}</AddressDetail>\n`;
    xml += `      <City>${this.escapeXML(clinica.cidade || '')}</City>\n`;
    xml += `      <PostalCode>${clinica.codigoPostal || ''}</PostalCode>\n`;
    xml += `      <Country>${clinica.pais || 'PT'}</Country>\n`;
    xml += `    </CompanyAddress>\n`;
    xml += `    <FiscalYear>${options.dataInicio.getFullYear()}</FiscalYear>\n`;
    xml += `    <StartDate>${this.formatDate(options.dataInicio)}</StartDate>\n`;
    xml += `    <EndDate>${this.formatDate(options.dataFim)}</EndDate>\n`;
    xml += `    <CurrencyCode>EUR</CurrencyCode>\n`;
    xml += `    <DateCreated>${this.formatDate(new Date())}</DateCreated>\n`;
    xml += `    <TaxEntity>Global</TaxEntity>\n`;
    xml += `    <ProductCompanyTaxID>999999990</ProductCompanyTaxID>\n`; // NIF do software
    xml += `    <SoftwareCertificateNumber>0</SoftwareCertificateNumber>\n`;
    xml += `    <ProductID>DentCarePro SaaS/5.6.0</ProductID>\n`;
    xml += `    <ProductVersion>5.6.0</ProductVersion>\n`;
    xml += '  </Header>\n';

    // Master Files (Clientes)
    xml += '  <MasterFiles>\n';
    xml += this.gerarMasterFiles(faturas);
    xml += '  </MasterFiles>\n';

    // Source Documents (Faturas)
    xml += '  <SourceDocuments>\n';
    xml += '    <SalesInvoices>\n';
    xml += `      <NumberOfEntries>${faturas.length}</NumberOfEntries>\n`;
    xml += `      <TotalDebit>${this.calcularTotalDebito(faturas)}</TotalDebit>\n`;
    xml += `      <TotalCredit>0.00</TotalCredit>\n`;
    
    faturas.forEach((fatura, index) => {
      xml += this.gerarInvoice(fatura, index + 1);
    });
    
    xml += '    </SalesInvoices>\n';
    xml += '  </SourceDocuments>\n';

    xml += '</AuditFile>';

    return xml;
  }

  /**
   * Gerar secao MasterFiles (Clientes)
   */
  private static gerarMasterFiles(faturas: any[]): string {
    let xml = '';
    
    // Extrair clientes unicos
    const clientesMap = new Map();
    faturas.forEach(f => {
      if (f.utentes && !clientesMap.has(f.utentes.id)) {
        clientesMap.set(f.utentes.id, f.utentes);
      }
    });

    const clientes = Array.from(clientesMap.values());

    clientes.forEach(cliente => {
      xml += '    <Customer>\n';
      xml += `      <CustomerID>${cliente.id}</CustomerID>\n`;
      xml += `      <AccountID>Desconhecido</AccountID>\n`;
      xml += `      <CustomerTaxID>${cliente.nif || '999999990'}</CustomerTaxID>\n`;
      xml += `      <CompanyName>${this.escapeXML(cliente.nome)}</CompanyName>\n`;
      xml += `      <BillingAddress>\n`;
      xml += `        <AddressDetail>${this.escapeXML(cliente.morada || 'Desconhecido')}</AddressDetail>\n`;
      xml += `        <City>${this.escapeXML(cliente.cidade || 'Desconhecido')}</City>\n`;
      xml += `        <PostalCode>${cliente.codigoPostal || '0000-000'}</PostalCode>\n`;
      xml += `        <Country>${cliente.pais || 'PT'}</Country>\n`;
      xml += `      </BillingAddress>\n`;
      xml += `      <SelfBillingIndicator>0</SelfBillingIndicator>\n`;
      xml += '    </Customer>\n';
    });

    return xml;
  }

  /**
   * Gerar uma fatura individual
   */
  private static gerarInvoice(faturaData: any, numero: number): string {
    const fatura = faturaData.faturas;
    const utente = faturaData.utentes;

    let xml = '      <Invoice>\n';
    xml += `        <InvoiceNo>${fatura.numeroFatura || numero}</InvoiceNo>\n`;
    xml += `        <DocumentStatus>\n`;
    xml += `          <InvoiceStatus>${fatura.estado === 'cancelada' ? 'A' : 'N'}</InvoiceStatus>\n`; // N=Normal, A=Anulado
    xml += `          <InvoiceStatusDate>${this.formatDateTime(fatura.dataFatura)}</InvoiceStatusDate>\n`;
    xml += `          <SourceID>Admin</SourceID>\n`;
    xml += `          <SourceBilling>P</SourceBilling>\n`; // P=Producao
    xml += `        </DocumentStatus>\n`;
    xml += `        <Hash>0</Hash>\n`; // Simplificado
    xml += `        <HashControl>0</HashControl>\n`;
    xml += `        <InvoiceDate>${this.formatDate(fatura.dataFatura)}</InvoiceDate>\n`;
    xml += `        <InvoiceType>FT</InvoiceType>\n`; // FT=Fatura
    xml += `        <SourceID>Admin</SourceID>\n`;
    xml += `        <SystemEntryDate>${this.formatDateTime(fatura.createdAt || fatura.dataFatura)}</SystemEntryDate>\n`;
    xml += `        <CustomerID>${utente?.id || 0}</CustomerID>\n`;

    // Linhas da fatura
    xml += '        <Line>\n';
    xml += `          <LineNumber>1</LineNumber>\n`;
    xml += `          <ProductCode>SERVICO</ProductCode>\n`;
    xml += `          <ProductDescription>Servicos dentarios</ProductDescription>\n`;
    xml += `          <Quantity>1</Quantity>\n`;
    xml += `          <UnitOfMeasure>UN</UnitOfMeasure>\n`;
    xml += `          <UnitPrice>${this.formatDecimal(fatura.valorTotal)}</UnitPrice>\n`;
    xml += `          <TaxPointDate>${this.formatDate(fatura.dataFatura)}</TaxPointDate>\n`;
    xml += `          <Description>Servicos dentarios</Description>\n`;
    xml += `          <DebitAmount>${this.formatDecimal(fatura.valorTotal)}</DebitAmount>\n`;
    xml += `          <Tax>\n`;
    xml += `            <TaxType>IVA</TaxType>\n`;
    xml += `            <TaxCountryRegion>PT</TaxCountryRegion>\n`;
    xml += `            <TaxCode>ISE</TaxCode>\n`; // ISE=Isento (servicos medicos)
    xml += `            <TaxPercentage>0.00</TaxPercentage>\n`;
    xml += `          </Tax>\n`;
    xml += `          <TaxExemptionReason>Isento nos termos do artigo 9 do CIVA</TaxExemptionReason>\n`;
    xml += `          <SettlementAmount>0.00</SettlementAmount>\n`;
    xml += '        </Line>\n';

    // Totais
    xml += '        <DocumentTotals>\n';
    xml += `          <TaxPayable>0.00</TaxPayable>\n`;
    xml += `          <NetTotal>${this.formatDecimal(fatura.valorTotal)}</NetTotal>\n`;
    xml += `          <GrossTotal>${this.formatDecimal(fatura.valorTotal)}</GrossTotal>\n`;
    xml += '        </DocumentTotals>\n';

    xml += '      </Invoice>\n';

    return xml;
  }

  /**
   * Calcular total de debito
   */
  private static calcularTotalDebito(faturas: any[]): string {
    const total = faturas.reduce((sum, f) => {
      return sum + parseFloat(f.faturas.valorTotal || 0);
    }, 0);
    return this.formatDecimal(total);
  }

  /**
   * Formatar data (YYYY-MM-DD)
   */
  private static formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Formatar data e hora (YYYY-MM-DDTHH:mm:ss)
   */
  private static formatDateTime(date: Date): string {
    return date.toISOString().split('.')[0];
  }

  /**
   * Formatar decimal (2 casas)
   */
  private static formatDecimal(value: number | string): string {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return num.toFixed(2);
  }

  /**
   * Escapar caracteres especiais XML
   */
  private static escapeXML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Exportar para Excel (formato simples para contabilistas)
   */
  static async exportarExcel(options: SAFTExportOptions): Promise<any[]> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Obter faturas com detalhes
    const faturasData = await db
      .select({
        numeroFatura: faturas.numeroFatura,
        dataFatura: faturas.dataFatura,
        dataVencimento: faturas.dataVencimento,
        utenteNome: utentes.nome,
        utenteNIF: utentes.nif,
        valorTotal: faturas.valorTotal,
        valorPago: faturas.valorPago,
        estado: faturas.estado,
        observacoes: faturas.observacoes,
      })
      .from(faturas)
      .leftJoin(utentes, eq(faturas.utenteId, utentes.id))
      .where(
        and(
          eq(faturas.clinicaId, options.clinicaId),
          gte(faturas.dataFatura, options.dataInicio),
          lte(faturas.dataFatura, options.dataFim)
        )
      );

    return faturasData;
  }

  /**
   * Gerar relatorio de IVA para contabilista
   */
  static async relatorioIVA(clinicaId: number, ano: number, trimestre: number) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Calcular datas do trimestre
    const mesInicio = (trimestre - 1) * 3 + 1;
    const mesFim = trimestre * 3;
    const dataInicio = new Date(ano, mesInicio - 1, 1);
    const dataFim = new Date(ano, mesFim, 0);

    // Obter faturas do trimestre
    const faturasData = await db
      .select()
      .from(faturas)
      .where(
        and(
          eq(faturas.clinicaId, clinicaId),
          gte(faturas.dataFatura, dataInicio),
          lte(faturas.dataFatura, dataFim)
        )
      );

    // Calcular totais
    const totalFaturado = faturasData.reduce((sum, f) => sum + parseFloat(f.valorTotal), 0);
    const totalPago = faturasData.reduce((sum, f) => sum + parseFloat(f.valorPago), 0);

    // Servicos medicos sao isentos de IVA em Portugal (Art. 9 CIVA)
    const ivaIsento = totalFaturado;
    const ivaCobrado = 0;

    return {
      periodo: `${ano} - ${trimestre}º Trimestre`,
      dataInicio,
      dataFim,
      numeroFaturas: faturasData.length,
      totalFaturado,
      totalPago,
      ivaIsento,
      ivaCobrado,
      observacoes: "Servicos medicos isentos de IVA nos termos do artigo 9 do CIVA",
    };
  }
}

export default SAFTExportService;
