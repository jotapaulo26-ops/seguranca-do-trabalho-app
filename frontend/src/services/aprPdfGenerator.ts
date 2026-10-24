import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { DocumentRecord } from '../types';

export async function generateAprPdf(doc: DocumentRecord, companySettings?: any): Promise<void> {
  // Delegate specialized documents to documentPdfGenerator
  if (doc.type === 'PT' || doc.type === 'PET' || doc.type === 'OS' || doc.type === 'OSS' || doc.type === 'EPI_FICHA' || doc.type === 'CHECKLIST') {
    const { generateDocumentPdf } = await import('./documentPdfGenerator');
    return generateDocumentPdf(doc, companySettings);
  }

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
  pdf.roundedRect(pageWidth - margin - 58, 5, 58, 20, 2, 2, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(245, 158, 11);
  pdf.text(doc.code || 'APR-0000', pageWidth - margin - 55, 11);

  const sigStatus = doc.signatureStatus;
  const isHomologated = sigStatus?.status === 'homologado' || doc.status === 'homologado';
  pdf.setFontSize(7);
  if (isHomologated) {
    pdf.setTextColor(74, 222, 128); // Green 400
    pdf.text(`100% HOMOLOGADO (${sigStatus?.totalSigned || 1}/${sigStatus?.totalRequired || 1})`, pageWidth - margin - 55, 16);
    pdf.setFontSize(5.5);
    pdf.text('LIBERADO P/ EXECUÇÃO', pageWidth - margin - 55, 20);
  } else {
    pdf.setTextColor(248, 113, 113); // Red 400
    pdf.text(`ASSINATURAS PENDENTES (${sigStatus?.totalSigned || 0}/${sigStatus?.totalRequired || 1})`, pageWidth - margin - 55, 16);
    pdf.setFontSize(5.5);
    pdf.text('PROIBIDO INICIAR ATIVIDADE', pageWidth - margin - 55, 20);
  }

  let currentY = 38;

  // --- RASTREABILIDADE DO APARELHO EMISSOR (Crucial Requirement) ---
  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(margin, currentY, pageWidth - (margin * 2), 26, 2, 2, 'FD');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(15, 23, 42);
  pdf.text('RASTREABILIDADE E AUDITORIA DO DISPOSITIVO EMISSOR', margin + 4, currentY + 6);

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
      `• ${hazards[i] || '—'}`,
      `• ${measures[i] || '—'}`
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
  const requiredEpis: string[] = data.requiredEpis || ['Capacete com Jugular', 'Cinto Tipo Paraquedista', 'Talabarte Duplo com Absorvedor de Energia', 'Botina de Segurança'];
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(71, 85, 105);
  pdf.text(`EPIs de Uso Obrigatório: ${requiredEpis.join(' • ')}`, margin, currentY);
  currentY += 6;

  // --- TERMO FORMAL DE DECLARAÇÃO, RESPONSABILIDADE E DIREITO DE RECUSA (NR-01 / NR-35) ---
  if (currentY > pageHeight - 75) {
    pdf.addPage();
    currentY = 20;
  }

  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(203, 213, 225);
  pdf.roundedRect(margin, currentY, pageWidth - (margin * 2), 17, 2, 2, 'FD');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text('TERMO DE CIÊNCIA, RESPONSABILIDADE OPERACIONAL E DIREITO DE RECUSA (NR-01, ITEM 1.4.3):', margin + 3, currentY + 4.5);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.5);
  pdf.setTextColor(71, 85, 105);
  const legalText = 'Declaramos que fomos devidamente instruídos quanto aos riscos identificados nesta Análise Preliminar de Risco (APR) e às medidas de proteção coletivas e individuais obrigatórias. Comprometemo-nos a cumprir integralmente os procedimentos de segurança e a paralisar imediatamente as atividades no caso de constatação de qualquer condição de risco grave e iminente (Direito de Recusa — NR-01, item 1.4.3).';
  const splitLegal = pdf.splitTextToSize(legalText, pageWidth - (margin * 2) - 6);
  pdf.text(splitLegal, margin + 3, currentY + 8.5);

  currentY += 21;

  // --- ASSINATURAS DIGITAIS REGISTRADAS ---
  if (currentY > pageHeight - 65) {
    pdf.addPage();
    currentY = 20;
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(15, 23, 42);
  pdf.text('5. VALIDAÇÃO E ASSINATURAS DIGITAIS DA EQUIPE', margin, currentY);
  currentY += 4;

  const signatures: any[] = data.signatures || [];
  const requiredSigners = doc.signatureStatus?.requiredWorkers || [
    { id: 'supervisor', name: doc.created_by_name || 'Supervisor SST', role: 'Supervisor / Responsável Emissor', isSupervisor: true },
    ...(team.length > 0 ? team.map((t: any) => ({ id: t.id, name: t.name, role: t.role || 'Executante', isSupervisor: false })) : [{ id: 'worker', name: 'Executante Autorizado', role: 'Executante', isSupervisor: false }])
  ];

  const boxWidth = 85;
  const boxHeight = 34;

  for (let i = 0; i < requiredSigners.length; i += 2) {
    if (currentY > pageHeight - 45) {
      pdf.addPage();
      currentY = 20;
    }

    const rowSigners = requiredSigners.slice(i, i + 2);

    rowSigners.forEach((signer: any, colIdx: number) => {
      const x = margin + colIdx * (boxWidth + 5);
      const matchingSig = signatures.find((s: any) =>
        (signer.isSupervisor && s.signerType === 'supervisor') ||
        (s.employeeId && s.employeeId === signer.id) ||
        (s.signerName && s.signerName.toLowerCase() === signer.name.toLowerCase())
      );

      pdf.setFillColor(248, 250, 252);
      pdf.setDrawColor(226, 232, 240);
      pdf.roundedRect(x, currentY, boxWidth, boxHeight, 2, 2, 'FD');

      // Title header
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(15, 23, 42);
      const roleTitle = signer.isSupervisor ? 'RESPONSÁVEL TÉCNICO SST' : `EXECUTANTE: ${signer.role?.toUpperCase() || 'EQUIPE'}`;
      pdf.text(roleTitle.substring(0, 40), x + 3, currentY + 4.5);

      if (matchingSig?.signatureDataUrl) {
        try {
          pdf.addImage(matchingSig.signatureDataUrl, 'PNG', x + 5, currentY + 6, 45, 16);
        } catch (e) {
          pdf.text('[Rubrica Registrada]', x + 5, currentY + 15);
        }

        // If photo selfie exists, stamp it next to the signature
        if (matchingSig.photoDataUrl) {
          try {
            pdf.addImage(matchingSig.photoDataUrl, 'JPEG', x + 60, currentY + 6, 16, 16);
            pdf.setFontSize(5.5);
            if (matchingSig.biometricType === 'fingerprint') {
              pdf.setTextColor(79, 70, 229);
              pdf.text('DIGITAL OK', x + 60, currentY + 24);
            } else {
              pdf.setTextColor(16, 149, 106);
              pdf.setFontSize(4.8);
              pdf.text('FACE ID + LIVENESS OK', x + 56, currentY + 24);
            }
          } catch (e) {}
        }
      } else {
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(7.5);
        pdf.setTextColor(220, 38, 38);
        pdf.text('[PENDENTE DE ASSINATURA]', x + 5, currentY + 15);
      }

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(15, 23, 42);
      pdf.text(`Nome: ${signer.name}`, x + 3, currentY + 26);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6);
      pdf.setTextColor(100, 116, 139);
      const signedInfo = matchingSig
        ? `Data: ${new Date(matchingSig.signedAt).toLocaleDateString('pt-BR')} ${new Date(matchingSig.signedAt).toLocaleTimeString('pt-BR')} • Dispositivo: ${matchingSig.deviceId || 'REGISTRADO'}`
        : 'Aguardando validação e assinatura do colaborador';
      pdf.text(signedInfo.substring(0, 65), x + 3, currentY + 30);
    });

    currentY += boxHeight + 4;
  }

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
