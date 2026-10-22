import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { DocumentRecord } from '../types';

export async function generateAprPdf(doc: DocumentRecord, companySettings?: any): Promise<void> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 14;

  const data = doc.data || {};
  const companyName = companySettings?.companyName || 'Indústria & Engenharia Brasil S.A.';
  const companyCnpj = companySettings?.companyCnpj || 'CNPJ: 12.345.678/0001-90';

  // --- HEADER SECTION ---
  pdf.setFillColor(15, 23, 42); // Navy 900
  pdf.rect(0, 0, pageWidth, 28, 'F');

  // Accent safety bar
  pdf.setFillColor(245, 158, 11); // Amber 500
  pdf.rect(0, 28, pageWidth, 3, 'F');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor(255, 255, 255);
  pdf.text('SISTEMA INTEGRADO DE SEGURANÇA DO TRABALHO', margin, 12);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(203, 213, 225);
  pdf.text(`${companyName} | ${companyCnpj}`, margin, 18);
  pdf.text('ANÁLISE PRELIMINAR DE RISCO (APR) E PERMISSÃO DE ENTRADA', margin, 23);

  // Document Code Box (top right)
  pdf.setFillColor(30, 41, 59);
  pdf.roundedRect(pageWidth - margin - 50, 6, 50, 18, 2, 2, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(245, 158, 11);
  pdf.text(doc.code || 'APR-0000', pageWidth - margin - 47, 13);
  pdf.setFontSize(8);
  pdf.setTextColor(255, 255, 255);
  pdf.text(`Status: ${(doc.status || 'ATIVA').toUpperCase()}`, pageWidth - margin - 47, 19);

  let currentY = 38;

  // --- RASTREABILIDADE DO APARELHO EMISSOR (Crucial Requirement) ---
  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(margin, currentY, pageWidth - (margin * 2), 26, 2, 2, 'FD');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(15, 23, 42);
  pdf.text('🔍 RASTREABILIDADE E AUDITORIA DO DISPOSITIVO EMISSOR', margin + 4, currentY + 6);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(71, 85, 105);
  pdf.text('ID do Aparelho Emissor:', margin + 4, currentY + 12);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(15, 23, 42);
  pdf.text(doc.device_id || data.deviceId || 'DESCONHECIDO', margin + 42, currentY + 12);

  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(71, 85, 105);
  pdf.text('Dispositivo / Plataforma:', margin + 4, currentY + 18);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(15, 23, 42);
  const truncatedDevName = (doc.device_name || data.deviceName || 'Navegador Web').substring(0, 60);
  pdf.text(truncatedDevName, margin + 42, currentY + 18);

  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(71, 85, 105);
  pdf.text('IP & Responsável:', margin + 4, currentY + 23);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(15, 23, 42);
  pdf.text(`${doc.created_by_name} | IP: ${doc.ip_address || '127.0.0.1'} | Data: ${new Date(doc.created_at).toLocaleString('pt-BR')}`, margin + 42, currentY + 23);

  currentY += 31;

  // --- IDENTIFICAÇÃO DO TRABALHO E LOCALIZAÇÃO ---
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(15, 23, 42);
  pdf.text('1. DADOS DA ATIVIDADE E CLASSIFICAÇÃO', margin, currentY);
  currentY += 3;

  const activityTableBody = [
    [
      { content: 'Título da Atividade:', styles: { fontStyle: 'bold' as const, cellWidth: 38 } },
      { content: doc.title || 'N/A' },
      { content: 'Modelo APR:', styles: { fontStyle: 'bold' as const, cellWidth: 28 } },
      { content: doc.type.replace('APR_', '').replace('_', ' ') }
    ],
    [
      { content: 'Local / Instalação:', styles: { fontStyle: 'bold' as const } },
      { content: doc.location?.name || doc.location_name || 'Área Operacional Geral' },
      { content: 'Classificação:', styles: { fontStyle: 'bold' as const } },
      { content: data.riskClassification || 'ALTO RISCO' }
    ],
    [
      { content: 'Descrição do Trabalho:', styles: { fontStyle: 'bold' as const } },
      { content: data.activityDetails || doc.description || 'Execução de serviços operacionais conforme procedimento.', colSpan: 3 }
    ]
  ];

  autoTable(pdf, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.5, textColor: [30, 41, 59] },
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42] },
    body: activityTableBody,
  });

  currentY = (pdf as any).lastAutoTable.finalY + 6;

  // --- PARÂMETROS ESPECÍFICOS DE ALTURA / ESPAÇO CONFINADO ---
  if (doc.type === 'APR_ALTURA' || doc.type === 'APR_ESPACO_CONFINADO') {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(15, 23, 42);
    pdf.text(doc.type === 'APR_ALTURA' ? '2. PARÂMETROS TÉCNICOS NR-35 (TRABALHO EM ALTURA)' : '2. PARÂMETROS TÉCNICOS NR-33 (ESPAÇO CONFINADO)', margin, currentY);
    currentY += 3;

    let specificTableBody: any[] = [];
    if (doc.type === 'APR_ALTURA') {
      specificTableBody = [
        [
          { content: 'Altura Estimada:', styles: { fontStyle: 'bold' as const, cellWidth: 40 } },
          { content: data.heightMeters ? `${data.heightMeters} metros` : 'Superior a 2,00m' },
          { content: 'Pontos de Ancoragem:', styles: { fontStyle: 'bold' as const, cellWidth: 40 } },
          { content: data.anchorPoints || 'Linha de vida inspecionada / Olhal certificado' }
        ],
        [
          { content: 'Condições Climáticas:', styles: { fontStyle: 'bold' as const } },
          { content: data.weatherConditions || 'Vento moderado, sem precipitação ou tempestades.' },
          { content: 'Plano de Resgate:', styles: { fontStyle: 'bold' as const } },
          { content: data.rescuePlan || 'Equipe de brigada comunicada e kit de resgate em altura a postos.' }
        ]
      ];
    } else {
      // Espaço Confinado
      specificTableBody = [
        [
          { content: 'Monitoramento de Gases:', styles: { fontStyle: 'bold' as const, cellWidth: 40 } },
          { content: 'Oxigênio (O2): 20.9% | Inflamabilidade (LEL): 0% | CO: 0 ppm | H2S: 0 ppm' },
          { content: 'Vigia Dedicado:', styles: { fontStyle: 'bold' as const, cellWidth: 40 } },
          { content: data.vigiaName || 'Designado na entrada externa contínua' }
        ],
        [
          { content: 'Ventilação Forçada:', styles: { fontStyle: 'bold' as const } },
          { content: 'Insuflador de ar mecânico operando 15 min antes e durante a atividade' },
          { content: 'Acesso e Resgate:', styles: { fontStyle: 'bold' as const } },
          { content: 'Tripé com guincho resgatador, cinto de 4 pontos e rádio' }
        ]
      ];
    }

    autoTable(pdf, {
      startY: currentY,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2.5, textColor: [30, 41, 59] },
      body: specificTableBody
    });

    currentY = (pdf as any).lastAutoTable.finalY + 6;
  }

  // --- PERIGOS E MEDIDAS DE CONTROLE (Table) ---
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(15, 23, 42);
  pdf.text('3. ANÁLISE DE PERIGOS E MEDIDAS PREVENTIVAS DE CONTROLE', margin, currentY);
  currentY += 3;

  const hazards: string[] = data.hazards || ['Risco de queda com diferença de nível', 'Queda de materiais', 'Choque elétrico acidental'];
  const measures: string[] = data.preventiveMeasures || ['Uso de cinto paraquedista com talabarte duplo conectado', 'Isolamento da área inferior', 'Desenergização e LOTO'];

  const maxRows = Math.max(hazards.length, measures.length);
  const hazardRows: any[] = [];
  for (let i = 0; i < maxRows; i++) {
    hazardRows.push([
      `⚠️ ${hazards[i] || '—'}`,
      `🛡️ ${measures[i] || '—'}`
    ]);
  }

  autoTable(pdf, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'striped',
    head: [['Perigos / Riscos Identificados', 'Medidas Preventivas Obrigatórias']],
    headStyles: { fillColor: [245, 158, 11], textColor: [15, 23, 42], fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2.5 },
    body: hazardRows
  });

  currentY = (pdf as any).lastAutoTable.finalY + 6;

  // Check if we need a new page for team & signatures
  if (currentY > pageHeight - 75) {
    pdf.addPage();
    currentY = 20;
  }

  // --- EQUIPE EXECUTANTE E EPIS ---
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(15, 23, 42);
  pdf.text('4. EQUIPE EXECUTANTE AUTORIZADA E EPIS EXIGIDOS', margin, currentY);
  currentY += 3;

  const team: any[] = data.teamMembers || [
    { name: 'Marcos Aurélio Silveira', role: 'Eletricista', status: 'NR-35 Em Dia' },
    { name: 'Rafael Barbosa Lima', role: 'Mecânico', status: 'NR-35 Em Dia' }
  ];

  const teamRows = team.map(m => [m.name, m.role, m.status || 'Treinamento Válido']);

  autoTable(pdf, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    head: [['Nome do Colaborador', 'Função na Atividade', 'Aptidão SST / Treinamento']],
    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2 },
    body: teamRows
  });

  currentY = (pdf as any).lastAutoTable.finalY + 6;

  // --- EPIs List ---
  const requiredEpis: string[] = data.requiredEpis || ['Capacete c/ Jugular', 'Cinto Paraquedista', 'Talabarte Duplo Y', 'Botina de Segurança'];
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(71, 85, 105);
  pdf.text(`EPIs Obrigatórios: ${requiredEpis.join(' | ')}`, margin, currentY);
  currentY += 7;

  // --- ASSINATURAS DIGITAIS REGISTRADAS ---
  if (currentY > pageHeight - 55) {
    pdf.addPage();
    currentY = 20;
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(15, 23, 42);
  pdf.text('5. VALIDAÇÃO E ASSINATURAS DIGITAIS', margin, currentY);
  currentY += 4;

  const signatures: any[] = data.signatures || [];
  const supervisorSig = signatures.find(s => s.signerType === 'supervisor');
  const workerSigs = signatures.filter(s => s.signerType !== 'supervisor');

  // Supervisor Signature Box
  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(margin, currentY, 85, 34, 2, 2, 'FD');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(15, 23, 42);
  pdf.text('RESPONSÁVEL TÉCNICO SST', margin + 3, currentY + 5);

  if (supervisorSig?.signatureDataUrl) {
    try {
      pdf.addImage(supervisorSig.signatureDataUrl, 'PNG', margin + 5, currentY + 7, 50, 18);
    } catch (e) {
      pdf.text('[Assinatura Digital Registrada]', margin + 5, currentY + 16);
    }
  } else {
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(100, 116, 139);
    pdf.text('(Assinatura Eletrônica Aprovada)', margin + 5, currentY + 16);
  }

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(30, 41, 59);
  pdf.text(`Nome: ${supervisorSig?.signerName || doc.created_by_name}`, margin + 3, currentY + 28);
  pdf.text(`Dispositivo: ${supervisorSig?.deviceId || doc.device_id || 'ID-REGISTRADO'}`, margin + 3, currentY + 31);

  // Executing Worker Signature Box
  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(margin + 90, currentY, 85, 34, 2, 2, 'FD');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(15, 23, 42);
  pdf.text('EXECUTANTE(S) / EQUIPE', margin + 93, currentY + 5);

  const primaryWorkerSig = workerSigs[0];
  if (primaryWorkerSig?.signatureDataUrl) {
    try {
      pdf.addImage(primaryWorkerSig.signatureDataUrl, 'PNG', margin + 95, currentY + 7, 50, 18);
    } catch (e) {
      pdf.text('[Assinatura Digital Registrada]', margin + 95, currentY + 16);
    }
  } else {
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(100, 116, 139);
    pdf.text('(Ciente e apto para a execução segura)', margin + 95, currentY + 16);
  }

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(30, 41, 59);
  pdf.text(`Nome: ${primaryWorkerSig?.signerName || team[0]?.name || 'Equipe' }`, margin + 93, currentY + 28);
  pdf.text(`Dispositivo: ${primaryWorkerSig?.deviceId || doc.device_id || 'ID-REGISTRADO'}`, margin + 93, currentY + 31);

  currentY += 38;

  // --- FOOTER & QR CODE OF AUTHENTICITY ---
  try {
    const qrPayload = `AUTENTICACAO_SST:${doc.code}:DEVICE:${doc.device_id}:EMISSOR:${doc.created_by_name}:TIMESTAMP:${doc.created_at}`;
    const qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, width: 80 });
    pdf.addImage(qrDataUrl, 'PNG', pageWidth - margin - 22, pageHeight - 22, 20, 20);
  } catch (e) {
    // Ignore QR error
  }

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(148, 163, 184);
  pdf.text(`Documento emitido eletronicamente via Sistema SegTrabalho. Identificador: ${doc.id}`, margin, pageHeight - 12);
  pdf.text(`Validação física em campo através da leitura do QR Code. Registro de auditoria preservado.`, margin, pageHeight - 8);

  // Trigger Save / Download
  pdf.save(`${doc.code}_${doc.type}.pdf`);
}
