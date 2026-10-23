import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { DocumentRecord } from '../types';

// Helper for Header
function renderHeader(
  pdf: jsPDF,
  title: string,
  doc: DocumentRecord,
  companySettings?: any,
  bannerColor: [number, number, number] = [15, 23, 42],
  accentColor: [number, number, number] = [245, 158, 11]
) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 14;
  const companyName = companySettings?.companyName || 'Indústria & Engenharia Brasil S.A.';
  const companyCnpj = companySettings?.companyCnpj || 'CNPJ: 12.345.678/0001-90';

  pdf.setFillColor(...bannerColor);
  pdf.rect(0, 0, pageWidth, 28, 'F');

  pdf.setFillColor(...accentColor);
  pdf.rect(0, 28, pageWidth, 3, 'F');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(255, 255, 255);
  pdf.text('SISTEMA INTEGRADO DE SEGURANÇA DO TRABALHO', margin, 12);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(203, 213, 225);
  pdf.text(`${companyName} | ${companyCnpj}`, margin, 18);
  pdf.text(title.toUpperCase(), margin, 23);

  // Document Code Box
  pdf.setFillColor(30, 41, 59);
  pdf.roundedRect(pageWidth - margin - 52, 6, 52, 18, 2, 2, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  pdf.text(doc.code || 'DOC-0000', pageWidth - margin - 49, 13);
  pdf.setFontSize(8);
  pdf.setTextColor(255, 255, 255);
  pdf.text(`Status: ${(doc.status || 'ATIVA').toUpperCase()}`, pageWidth - margin - 49, 19);

  return 36;
}

// Helper for Device Audit Box
function renderDeviceAuditBox(pdf: jsPDF, doc: DocumentRecord, startY: number): number {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 14;
  const data = doc.data || {};

  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(margin, startY, pageWidth - margin * 2, 24, 2, 2, 'FD');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text('RASTREABILIDADE DIGITAL E AUDITORIA DO DISPOSITIVO EMISSOR', margin + 4, startY + 5.5);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.5);
  pdf.setTextColor(71, 85, 105);
  pdf.text('ID do Aparelho Emissor:', margin + 4, startY + 11.5);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(15, 23, 42);
  pdf.text(doc.device_id || data.deviceId || 'DISPOSITIVO-WEB', margin + 40, startY + 11.5);

  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(71, 85, 105);
  pdf.text('Dispositivo / Plataforma:', margin + 4, startY + 16.5);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(15, 23, 42);
  pdf.text((doc.device_name || data.deviceName || 'Navegador Web').substring(0, 65), margin + 40, startY + 16.5);

  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(71, 85, 105);
  pdf.text('Emitente, IP & Horário:', margin + 4, startY + 21);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(15, 23, 42);
  pdf.text(
    `${doc.created_by_name} | IP: ${doc.ip_address || '127.0.0.1'} | Emitido: ${new Date(doc.created_at).toLocaleString('pt-BR')}`,
    margin + 40,
    startY + 21
  );

  return startY + 28;
}

// 1. GENERATE PT / PET PDF
export async function generatePtPdf(doc: DocumentRecord, companySettings?: any): Promise<void> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 14;
  const data = doc.data || {};
  const isPet = doc.type === 'PET' || !!data.isPet;

  const headerTitle = isPet
    ? 'PET — PERMISSÃO DE ENTRADA E TRABALHO EM ESPAÇO CONFINADO (NR-33)'
    : 'PT — PERMISSÃO DE TRABALHO ESPECIAL (NR-34 / NR-35 / NR-10)';

  const bannerColor: [number, number, number] = isPet ? [153, 27, 27] : [15, 23, 42]; // Red if PET
  const accentColor: [number, number, number] = isPet ? [239, 68, 68] : [245, 158, 11];

  let currentY = renderHeader(pdf, headerTitle, doc, companySettings, bannerColor, accentColor);
  currentY = renderDeviceAuditBox(pdf, doc, currentY);

  // Section 1: Atividade e Validade
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text('1. DADOS DE IDENTIFICAÇÃO E VALIDADE DA AUTORIZAÇÃO', margin, currentY);
  currentY += 2;

  const workTypesList = (data.workTypes || []).map((w: string) => w.toUpperCase().replace('_', ' ')).join(', ') || 'TRABALHO GERAL';
  const valStart = data.validityStart ? new Date(data.validityStart).toLocaleString('pt-BR') : 'Imediato';
  const valEnd = data.validityEnd ? new Date(data.validityEnd).toLocaleString('pt-BR') : 'Ao término da jornada (8h)';

  autoTable(pdf, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    body: [
      [
        { content: 'Título da Atividade:', styles: { fontStyle: 'bold', cellWidth: 35 } },
        { content: doc.title },
        { content: 'Tipos Autorizados:', styles: { fontStyle: 'bold', cellWidth: 30 } },
        { content: workTypesList }
      ],
      [
        { content: 'Local / Setor:', styles: { fontStyle: 'bold' } },
        { content: doc.location_name || 'Instalações da Empresa' },
        { content: 'Validade:', styles: { fontStyle: 'bold' } },
        { content: `${valStart} até ${valEnd}` }
      ],
      [
        { content: 'Supervisor de Entrada:', styles: { fontStyle: 'bold' } },
        { content: data.supervisorName || doc.created_by_name },
        { content: isPet ? 'Vigia Designado (NR-33):' : 'Responsável da Frente:', styles: { fontStyle: 'bold' } },
        { content: data.watchName || 'Conforme equipe' }
      ]
    ]
  });

  currentY = (pdf as any).lastAutoTable.finalY + 5;

  // Section 2: Executantes Autorizados
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  pdf.text('2. EXECUTANTES AUTORIZADOS E CAPACITADOS', margin, currentY);
  currentY += 2;

  const workers = data.authorizedWorkers || [];
  const workerRows = workers.length > 0
    ? workers.map((w: any, idx: number) => [
        (idx + 1).toString(),
        w.name || 'Colaborador',
        w.cpf || 'Cadastrado no sistema',
        w.role || 'Executante',
        'Capacitação Validada (Apto)'
      ])
    : [['1', 'Equipe de manutenção autorizada', '-', 'Executante', 'Apto']];

  autoTable(pdf, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Item', 'Nome do Trabalhador', 'CPF', 'Função', 'Condição de Acesso']],
    body: workerRows,
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] }
  });

  currentY = (pdf as any).lastAutoTable.finalY + 5;

  // Section 3: Teste de Gases (se PET ou se houver medições)
  if (isPet || (data.gasMeasurements && data.gasMeasurements.length > 0)) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(153, 27, 27);
    pdf.text('3. AVALIAÇÃO DA ATMOSFERA E MEDIÇÃO CONTÍNUA DE GASES (NR-33)', margin, currentY);
    currentY += 2;

    const gasRows = (data.gasMeasurements || [
      { time: 'Início', o2: '20.9%', lel: '0% LEL', co: '0 ppm', h2s: '0 ppm', tester: data.supervisorName || 'SST', status: 'ok' }
    ]).map((g: any) => [
      g.time || 'Registro',
      g.o2 || '20.9%',
      g.lel || '0%',
      g.co || '0 ppm',
      g.h2s || '0 ppm',
      g.tester || 'Supervisor',
      (g.status || 'OK').toUpperCase()
    ]);

    autoTable(pdf, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [['Horário', 'Oxigênio (O2: 19.5-23%)', 'Inflamabilidade (LEL < 10%)', 'Monóxido Carbono (CO < 25ppm)', 'Gás Sulfídrico (H2S < 8ppm)', 'Aferidor', 'Resultado']],
      body: gasRows,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: [153, 27, 27], textColor: [255, 255, 255] }
    });

    currentY = (pdf as any).lastAutoTable.finalY + 5;
  }

  // Section 4: Medidas de Segurança e Emergência
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text('4. MEDIDAS PREVENTIVAS DE CONTROLE E PLANO DE EMERGÊNCIA', margin, currentY);
  currentY += 2;

  const measures = data.safetyMeasures || [
    'Isolamento e sinalização visual da área',
    'Uso obrigatório de todos os EPIs indicados',
    'Bloqueio elétrico LOTO confirmado'
  ];

  autoTable(pdf, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: 1.5 },
    body: measures.map((m: string) => [{ content: `[X] ${m}` }])
  });

  currentY = (pdf as any).lastAutoTable.finalY + 5;

  // Termo de Responsabilidade e Liberação da PT / PET
  const pageHeightPt = pdf.internal.pageSize.getHeight();
  if (currentY > pageHeightPt - 75) {
    pdf.addPage();
    currentY = 20;
  }

  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(203, 213, 225);
  pdf.roundedRect(margin, currentY, pageWidth - margin * 2, 16, 2, 2, 'FD');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text(
    isPet
      ? 'TERMO DE ENTRADA EM ESPAÇO CONFINADO E SEGURANÇA OPERACIONAL (NR-33):'
      : 'TERMO DE LIBERAÇÃO, ENCERRAMENTO E SUSPENSÃO DA PERMISSÃO DE TRABALHO:',
    margin + 3,
    currentY + 4.5
  );

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.5);
  pdf.setTextColor(71, 85, 105);
  const ptLegalText = isPet
    ? 'Esta Permissão de Entrada e Trabalho (PET) é válida exclusivamente para o local e período aprovados. É obrigatória a presença contínua do Vigia na entrada externa e o monitoramento ininterrupto dos níveis atmosféricos. A entrada é imediatamente cancelada caso ocorra qualquer desvio nos gases ou alarme de evacuação.'
    : 'Esta Permissão de Trabalho (PT) autoriza exclusivamente as atividades e equipe relacionadas. É obrigatório manter a área isolada, os bloqueios LOTO ativos e suspender imediatamente os serviços em caso de intempéries ou risco grave e iminente. Ao término, a frente deve ser inspecionada e deixada em condições seguras.';
  const ptSplit = pdf.splitTextToSize(ptLegalText, pageWidth - margin * 2 - 6);
  pdf.text(ptSplit, margin + 3, currentY + 8.5);

  currentY += 20;

  // Section 5: Assinaturas Digitais
  renderSignaturesSection(pdf, data.signatures || [], currentY, [
    { title: 'Supervisor de Entrada / Responsável SST', name: data.supervisorName || doc.created_by_name },
    { title: isPet ? 'Vigia de Espaço Confinado' : 'Líder / Executante da Frente', name: data.watchName || 'Executante Líder' }
  ]);

  pdf.save(`${doc.code || 'PT'}.pdf`);
}

// 2. GENERATE ORDEM DE SERVIÇO NR-01 PDF
export async function generateOsPdf(doc: DocumentRecord, companySettings?: any): Promise<void> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 14;
  const data = doc.data || {};
  const emp = data.employee || {};

  let currentY = renderHeader(
    pdf,
    'ORDEM DE SERVIÇO DE SEGURANÇA E MEDICINA DO TRABALHO — NR-01',
    doc,
    companySettings,
    [15, 23, 42],
    [59, 130, 246] // Blue accent
  );
  currentY = renderDeviceAuditBox(pdf, doc, currentY);

  // Section 1: Dados do Colaborador
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text('1. DADOS CADASTRAIS DO COLABORADOR', margin, currentY);
  currentY += 2;

  autoTable(pdf, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    body: [
      [
        { content: 'Nome do Empregado:', styles: { fontStyle: 'bold', cellWidth: 35 } },
        { content: emp.name || doc.employee_name || 'Colaborador' },
        { content: 'CPF / Matrícula:', styles: { fontStyle: 'bold', cellWidth: 30 } },
        { content: `${emp.cpf || '-'} | Matr.: ${emp.registration_number || '-'}` }
      ],
      [
        { content: 'Cargo / Função:', styles: { fontStyle: 'bold' } },
        { content: emp.role || 'Operador' },
        { content: 'Setor / Departamento:', styles: { fontStyle: 'bold' } },
        { content: emp.department || 'Operações' }
      ],
      [
        { content: 'Descrição Sumária das Atividades:', styles: { fontStyle: 'bold' } },
        { content: data.activitiesDescription || 'Execução das tarefas inerentes ao cargo.', colSpan: 3 }
      ]
    ]
  });

  currentY = (pdf as any).lastAutoTable.finalY + 5;

  // Section 2: Riscos Ocupacionais
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  pdf.text('2. RECONHECIMENTO DE RISCOS OCUPACIONAIS NA FUNÇÃO', margin, currentY);
  currentY += 2;

  const risks = data.identifiedRisks || {};
  const riskRows = [
    ['Físicos', (risks.fisicos || ['Ruído']).join(', ')],
    ['Químicos', (risks.quimicos || ['Poeiras em suspensão']).join(', ')],
    ['Biológicos', (risks.biologicos || ['Ausentes']).join(', ')],
    ['Ergonômicos', (risks.ergonomicos || ['Postura em pé prolongada']).join(', ')],
    ['Acidentes / Mecânicos', (risks.acidentes || ['Queda de mesmo nível, impacto contra objetos']).join(', ')]
  ];

  autoTable(pdf, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Grupo de Risco', 'Fatores Identificados no Ambiente de Trabalho']],
    body: riskRows,
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] }
  });

  currentY = (pdf as any).lastAutoTable.finalY + 5;

  // Section 3: EPIs e Medidas de Prevenção
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  pdf.text('3. EQUIPAMENTOS DE PROTEÇÃO INDIVIDUAL (EPI) E MEDIDAS PREVENTIVAS', margin, currentY);
  currentY += 2;

  autoTable(pdf, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    body: [
      [
        { content: 'EPIs de Uso Obrigatório:', styles: { fontStyle: 'bold', cellWidth: 40 } },
        { content: (data.mandatoryEpis || []).join('; ') || 'Capacete, óculos, calçado de segurança e protetor auricular.' }
      ],
      [
        { content: 'Procedimentos e Medidas Preventivas:', styles: { fontStyle: 'bold' } },
        { content: (data.preventiveMeasures || []).join('; ') || 'Manter área limpa, não improvisar ferramentas e usar EPIs.' }
      ]
    ]
  });

  currentY = (pdf as any).lastAutoTable.finalY + 5;

  // Section 4: Obrigações e Proibições
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  pdf.text('4. OBRIGAÇÕES, PROIBIÇÕES E PENALIDADES (NR-01 / CLT ART. 158)', margin, currentY);
  currentY += 2;

  const obText = (data.employeeObligations || []).map((o: string, idx: number) => `${idx + 1}. ${o}`).join('\n');
  const prText = (data.prohibitions || []).map((p: string, idx: number) => `• ${p}`).join('\n');

  autoTable(pdf, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2 },
    body: [
      [{ content: 'Obrigações do Colaborador:', styles: { fontStyle: 'bold', cellWidth: 38 } }, { content: obText }],
      [{ content: 'Proibições Expressas:', styles: { fontStyle: 'bold' } }, { content: prText }],
      [{ content: 'Disposições Legais:', styles: { fontStyle: 'bold' } }, { content: data.penaltiesNotice || 'Art. 158 da CLT.' }]
    ]
  });

  currentY = (pdf as any).lastAutoTable.finalY + 4;

  // Section 5: Termo de Ciência e Compromisso do Colaborador (CLT Art. 158 / NR-01 item 1.4.2)
  const pageHeightOs = pdf.internal.pageSize.getHeight();
  if (currentY > pageHeightOs - 75) {
    pdf.addPage();
    currentY = 20;
  }

  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(203, 213, 225);
  pdf.roundedRect(margin, currentY, pageWidth - margin * 2, 18, 2, 2, 'FD');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text('TERMO DE CIÊNCIA, TREINAMENTO E COMPROMISSO DO TRABALHADOR (CLT ART. 158 / NR-01 ITEM 1.4.2):', margin + 3, currentY + 4.5);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.5);
  pdf.setTextColor(71, 85, 105);
  const ack = data.acknowledgementText ||
    'Declaro, para os devidos fins, ter recebido da empresa o treinamento específico e uma via desta Ordem de Serviço de Segurança e Saúde no Trabalho. Comprometo-me a cumprir rigorosamente as normas de segurança, utilizar todos os EPIs fornecidos e zelar pela minha integridade física e de meus colegas, ciente de que o descumprimento injustificado constitui ato faltoso passível de punição disciplinar conforme o Art. 158 da CLT c/c Art. 482 da CLT.';
  const ackSplit = pdf.splitTextToSize(ack, pageWidth - margin * 2 - 6);
  pdf.text(ackSplit, margin + 3, currentY + 8.5);

  currentY += 22;

  renderSignaturesSection(pdf, data.signatures || [], currentY, [
    { title: 'Responsável Técnico / Engenheiro de Segurança', name: doc.created_by_name },
    { title: 'Assinatura do Colaborador (Ciente)', name: emp.name || doc.employee_name || 'Colaborador' }
  ]);

  pdf.save(`${doc.code || 'OS'}.pdf`);
}

// 3. GENERATE FICHA DE ENTREGA DE EPI NR-06 PDF
export async function generateEpiReceiptPdf(doc: DocumentRecord, companySettings?: any): Promise<void> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 14;
  const data = doc.data || {};
  const emp = data.employee || {};

  let currentY = renderHeader(
    pdf,
    'FICHA DE CONTROLE, FORNECIMENTO E RECIBO DE EPI — NR-06',
    doc,
    companySettings,
    [15, 23, 42],
    [16, 185, 129] // Emerald accent
  );
  currentY = renderDeviceAuditBox(pdf, doc, currentY);

  // Colaborador
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text('1. IDENTIFICAÇÃO DO EMPREGADO', margin, currentY);
  currentY += 2;

  autoTable(pdf, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    body: [
      [
        { content: 'Nome do Empregado:', styles: { fontStyle: 'bold', cellWidth: 35 } },
        { content: emp.name || doc.employee_name || 'Colaborador' },
        { content: 'CPF / Matrícula:', styles: { fontStyle: 'bold', cellWidth: 30 } },
        { content: `${emp.cpf || '-'} | Matr.: ${emp.registration_number || '-'}` }
      ],
      [
        { content: 'Cargo / Função:', styles: { fontStyle: 'bold' } },
        { content: emp.role || 'Função Cadastrada' },
        { content: 'Setor:', styles: { fontStyle: 'bold' } },
        { content: emp.department || 'Planta Industrial' }
      ]
    ]
  });

  currentY = (pdf as any).lastAutoTable.finalY + 5;

  // Tabela de EPIs entregues com CA
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  pdf.text('2. RELAÇÃO DE EQUIPAMENTOS DE PROTEÇÃO INDIVIDUAL ENTREGUES', margin, currentY);
  currentY += 2;

  const items = data.deliveredItems || [];
  const itemRows = items.length > 0
    ? items.map((i: any, idx: number) => [
        (idx + 1).toString(),
        i.name,
        i.caNumber,
        new Date(i.deliveryDate || doc.created_at).toLocaleDateString('pt-BR'),
        (i.quantity || 1).toString(),
        i.condition || 'Novo / Em perfeito estado'
      ])
    : [['1', 'EPIs Padrão da Função', 'Válidos', new Date().toLocaleDateString('pt-BR'), '1 kit', 'Novo']];

  autoTable(pdf, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Item', 'Descrição do EPI Fornecido', 'Nº do CA', 'Data Entrega', 'Qtd', 'Estado de Conservação']],
    body: itemRows,
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 2.2 },
    headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] }
  });

  currentY = (pdf as any).lastAutoTable.finalY + 6;

  // Termo de Responsabilidade da NR-06
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('3. TERMO DE GUARDA, CONSERVAÇÃO E RESPONSABILIDADE POR EPI (NR-06, ITEM 6.6.1)', margin, currentY);
  currentY += 2;

  const term = data.termOfResponsibility ||
    'Declaro ter recebido da empresa, gratuitamente e em perfeito estado de conservação e funcionamento, os Equipamentos de Proteção Individual (EPI) constantes nesta ficha, devidamente higienizados e com os respectivos Certificados de Aprovação (C.A.) vigentes expedidos pelo Ministério do Trabalho e Emprego. Assumo o compromisso de utilizá-los estritamente durante a jornada de trabalho, zelar pela guarda e conservação, comunicar imediatamente qualquer alteração que os torne impróprios para uso e devolvê-los na rescisão contratual (NR-06 item 6.6.1 c/c CLT Art. 462, § 1º).';

  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(203, 213, 225);
  pdf.roundedRect(margin, currentY, pageWidth - margin * 2, 22, 2, 2, 'FD');
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.8);
  pdf.setTextColor(51, 65, 85);
  const termSplit = pdf.splitTextToSize(term, pageWidth - margin * 2 - 6);
  pdf.text(termSplit, margin + 3, currentY + 5.5);

  currentY += 28;

  renderSignaturesSection(pdf, data.signatures || [], currentY, [
    { title: 'Responsável pela Entrega / SST', name: doc.created_by_name },
    { title: 'Assinatura do Recebedor (Empregado)', name: emp.name || doc.employee_name || 'Colaborador' }
  ]);

  pdf.save(`${doc.code || 'EPI'}.pdf`);
}

// 4. GENERATE CHECKLIST PRÉ-OPERACIONAL PDF
export async function generateChecklistPdf(doc: DocumentRecord, companySettings?: any): Promise<void> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 14;
  const data = doc.data || {};

  let currentY = renderHeader(
    pdf,
    'CHECKLIST PRÉ-OPERACIONAL DE INSPEÇÃO DE CAMPO',
    doc,
    companySettings,
    [15, 23, 42],
    [168, 85, 247] // Purple accent
  );
  currentY = renderDeviceAuditBox(pdf, doc, currentY);

  // Equipamento / Frente
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text('1. DADOS DO EQUIPAMENTO / FRENTE INSPECIONADA', margin, currentY);
  currentY += 2;

  autoTable(pdf, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    body: [
      [
        { content: 'Equipamento / Estrutura:', styles: { fontStyle: 'bold', cellWidth: 40 } },
        { content: data.equipmentDescription || doc.title },
        { content: 'Identificação / TAG:', styles: { fontStyle: 'bold', cellWidth: 32 } },
        { content: data.equipmentCode || 'N/A' }
      ],
      [
        { content: 'Local / Setor:', styles: { fontStyle: 'bold' } },
        { content: doc.location_name || 'Frente de Trabalho' },
        { content: 'Inspetor Responsável:', styles: { fontStyle: 'bold' } },
        { content: data.inspectorName || doc.created_by_name }
      ]
    ]
  });

  currentY = (pdf as any).lastAutoTable.finalY + 5;

  // Itens Inspecionados
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  pdf.text('2. ITENS DE VERIFICAÇÃO DE SEGURANÇA (C = Conforme | NC = Não Conforme | NA = Não se Aplica)', margin, currentY);
  currentY += 2;

  const items = data.items || [];
  const itemRows = items.map((item: any, idx: number) => [
    (idx + 1).toString(),
    item.text,
    item.status === 'C' ? 'CONFORME (C)' : item.status === 'NC' ? 'NÃO CONFORME (NC)' : 'N/A',
    item.notes || '-'
  ]);

  autoTable(pdf, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Item', 'Condição / Requisito Avaliado', 'Status', 'Observações / Evidências']],
    body: itemRows,
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] }
  });

  currentY = (pdf as any).lastAutoTable.finalY + 5;

  // Conclusão e Resultado
  const isApproved = data.isApproved !== false;
  pdf.setFillColor(isApproved ? 236 : 254, isApproved ? 253 : 242, isApproved ? 245 : 242);
  pdf.setDrawColor(isApproved ? 16 : 239, isApproved ? 185 : 68, isApproved ? 129 : 68);
  pdf.roundedRect(margin, currentY, pageWidth - margin * 2, 22, 2, 2, 'FD');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  pdf.setTextColor(isApproved ? 16 : 220, isApproved ? 185 : 38, isApproved ? 129 : 38);
  pdf.text(`PARECER TÉCNICO FINAL: ${data.evaluationResult || (isApproved ? 'CONFORME / LIBERADO PARA OPERAÇÃO' : 'NÃO CONFORME / INTERDITADO')}`, margin + 4, currentY + 6);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(51, 65, 85);
  const chkObs = `Atesto que os itens inspecionados foram verificados em conformidade com as Normas Regulamentadoras vigentes. Observações: ${data.observations || 'Nenhuma anormalidade detectada no momento da vistoria pré-operacional.'}`;
  const chkSplit = pdf.splitTextToSize(chkObs, pageWidth - margin * 2 - 8);
  pdf.text(chkSplit, margin + 4, currentY + 11.5);

  currentY += 28;

  renderSignaturesSection(pdf, data.signatures || [], currentY, [
    { title: 'Inspetor de Segurança / Técnico SST', name: data.inspectorName || doc.created_by_name },
    { title: 'Responsável pela Operação / Operador', name: 'Encarregado do Setor' }
  ]);

  pdf.save(`${doc.code || 'CHK'}.pdf`);
}

// 5. HELPER FOR SIGNATURES BOXES
function renderSignaturesSection(
  pdf: jsPDF,
  signatures: any[],
  startY: number,
  defaultSigners: { title: string; name: string }[]
) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 14;
  const boxWidth = (pageWidth - margin * 2 - 10) / 2;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text('ASSINATURAS DIGITAIS E CONFORMIDADE SST', margin, startY);
  startY += 4;

  defaultSigners.forEach((signer, idx) => {
    const x = margin + idx * (boxWidth + 10);
    pdf.setDrawColor(203, 213, 225);
    pdf.setFillColor(248, 250, 252);
    pdf.roundedRect(x, startY, boxWidth, 32, 2, 2, 'FD');

    // Title / Cargo
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text(signer.title.toUpperCase(), x + 3, startY + 4.5);

    // Check if matching signature data URL exists
    const matchingSig = signatures.find((s: any) =>
      (s.signerName && signer.name && s.signerName.toLowerCase() === signer.name.toLowerCase()) ||
      (idx === 0 && s.signerType === 'supervisor') ||
      (idx > 0 && s.signerType !== 'supervisor')
    ) || signatures[idx];

    if (matchingSig && matchingSig.signatureDataUrl) {
      try {
        pdf.addImage(matchingSig.signatureDataUrl, 'PNG', x + 5, startY + 6, boxWidth - (matchingSig.photoDataUrl ? 30 : 15), 14);
      } catch (e) {
        pdf.text('[Assinatura Digital Registrada]', x + 5, startY + 14);
      }

      if (matchingSig.photoDataUrl) {
        try {
          pdf.addImage(matchingSig.photoDataUrl, 'JPEG', x + boxWidth - 18, startY + 6, 14, 14);
        } catch (e) {}
      }
    } else {
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(7.5);
      pdf.setTextColor(220, 38, 38);
      pdf.text('[PENDENTE DE ASSINATURA]', x + 5, startY + 14);
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text(signer.name, x + 3, startY + 23);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6);
    pdf.setTextColor(100, 116, 139);
    const timeInfo = matchingSig
      ? `Data: ${new Date(matchingSig.signedAt).toLocaleDateString('pt-BR')} ${new Date(matchingSig.signedAt).toLocaleTimeString('pt-BR')} • ID: ${matchingSig.deviceId || 'WEB'}`
      : 'Aguardando validação do colaborador';
    pdf.text(timeInfo.substring(0, 60), x + 3, startY + 26.5);

    if (matchingSig && matchingSig.photoDataUrl) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(5.5);
      pdf.setTextColor(16, 149, 106); // Emerald
      pdf.text('HOMOLOGADO COM BIOMETRIA FACIAL (FACE ID)', x + 3, startY + 30.5);
    }
  });
}

// MAIN DISPATCHER FUNCTION
export async function generateDocumentPdf(doc: DocumentRecord, companySettings?: any): Promise<void> {
  const type = doc.type;

  if (type === 'PT' || type === 'PET') {
    return generatePtPdf(doc, companySettings);
  }
  if (type === 'OS' || type === 'OSS') {
    return generateOsPdf(doc, companySettings);
  }
  if (type === 'EPI_FICHA') {
    return generateEpiReceiptPdf(doc, companySettings);
  }
  if (type === 'CHECKLIST') {
    return generateChecklistPdf(doc, companySettings);
  }

  // Fallback to standard APR generator
  const { generateAprPdf } = await import('./aprPdfGenerator');
  return generateAprPdf(doc, companySettings);
}
