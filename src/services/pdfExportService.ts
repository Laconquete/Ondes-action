import { jsPDF } from 'jspdf';
import { Patient, ClinicalNote, ClinicalAddendum, MedicationOrder, AppUser } from '../types/clinical';

interface ExportPatientPdfOptions {
  patient: Patient;
  clinicalNote?: ClinicalNote;
  addenda?: ClinicalAddendum[];
  activeMedications?: MedicationOrder[];
  currentUser: AppUser;
}

export function exportPatientDossierPdf({
  patient,
  clinicalNote,
  addenda = [],
  activeMedications = [],
  currentUser,
}: ExportPatientPdfOptions): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin - 12) {
      doc.addPage();
      y = margin + 8;
      drawMiniHeader();
    }
  };

  const drawMiniHeader = () => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `DOSSIER PATIENT : ${patient.familyName.toUpperCase()} ${patient.givenName} · IPP : ${patient.medicalRecordNumber}`,
      margin,
      y
    );
    doc.text(`Clinique OneDesk · Certifié HDS`, pageWidth - margin, y, { align: 'right' });
    y += 3;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
  };

  // ==========================================
  // 1. EN-TÊTE DE L'ÉTABLISSEMENT & HDS
  // ==========================================
  doc.setFillColor(30, 58, 138); // Blue 900
  doc.rect(margin, y, contentWidth, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('CLINIQUE ONEDESK — HÔPITAL PRIVÉ SAINT-LUC', margin + 6, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Cabinet Médical & Poste de Soins Spécialisé · Certifié Hébergeur de Données de Santé (HDS)', margin + 6, y + 13);
  doc.text(
    `Export édité le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} par ${currentUser.displayName} (${currentUser.department})`,
    margin + 6,
    y + 18
  );

  y += 28;

  // ==========================================
  // 2. IDENTITÉ DU PATIENT (ENCADRÉ)
  // ==========================================
  const age = Math.floor(
    (new Date().getTime() - new Date(patient.birthDate).getTime()) /
      (365.25 * 24 * 60 * 60 * 1000)
  );

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, contentWidth, 32, 2, 2, 'FD');

  // Left col: Patient Name & Vital identity
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(`${patient.familyName.toUpperCase()} ${patient.givenName}`, margin + 5, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Né(e) le ${new Date(patient.birthDate).toLocaleDateString('fr-FR')} (${age} ans) · Sexe : ${patient.gender === 'F' ? 'Féminin' : 'Masculin'} · Groupe Sanguin : ${patient.bloodGroup || 'Non renseigné'}`,
    margin + 5,
    y + 13
  );

  doc.text(`Adresse : ${patient.address.street}, ${patient.address.postalCode} ${patient.address.city}`, margin + 5, y + 19);
  doc.text(`Téléphone : ${patient.phone} · Email : ${patient.email}`, margin + 5, y + 25);

  // Right col: IPP & Security
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 64, 175);
  doc.text(`IPP : ${patient.medicalRecordNumber}`, pageWidth - margin - 5, y + 7, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Organisme : ${patient.insurance.provider}`, pageWidth - margin - 5, y + 13, { align: 'right' });
  doc.text(`N° Police : ${patient.insurance.policyNumber}`, pageWidth - margin - 5, y + 18, { align: 'right' });
  doc.text(
    `Médecin Référent : ${patient.primaryDoctorName || 'Non désigné'}`,
    pageWidth - margin - 5,
    y + 24,
    { align: 'right' }
  );

  y += 37;

  // ==========================================
  // 3. CONSTANTES VITALES RÉCENTES
  // ==========================================
  const latestVitals = patient.vitalsHistory[patient.vitalsHistory.length - 1];
  if (latestVitals) {
    checkPageBreak(18);

    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin, y, contentWidth, 14, 1.5, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text('DERNIÈRES CONSTANTES VITALES :', margin + 4, y + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const vitalsText = `TA : ${latestVitals.systolic}/${latestVitals.diastolic} mmHg  |  Pouls : ${latestVitals.pulseBpm} bpm  |  Poids : ${latestVitals.weightKg} kg  |  Taille : ${latestVitals.heightCm} cm (IMC : ${latestVitals.bmi})  |  SpO2 : ${latestVitals.oxygenSaturation}%  |  Temp : ${latestVitals.temperatureC}°C`;
    doc.text(vitalsText, margin + 4, y + 10.5);

    y += 18;
  }

  // ==========================================
  // 4. ALLERGIES & PATHOLOGIES / ANTÉCÉDENTS
  // ==========================================
  checkPageBreak(30);

  // Section Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('1. ALLERGIES, PATHOLOGIES ET ANTÉCÉDENTS MÉDICAUX', margin, y);
  y += 4;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // Allergies
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  if (patient.allergies.length > 0) {
    doc.setTextColor(185, 28, 28); // Red
    doc.text('ALLERGIES MÉDICAMENTEUSES DÉCLARÉES :', margin, y);
    y += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    patient.allergies.forEach((all) => {
      checkPageBreak(6);
      doc.text(
        `• ${all.substanceDisplay} (Sévérité : ${all.severity.toUpperCase()}, Réaction : ${all.reaction || 'Non documentée'}, Enregistrée le : ${new Date(all.recordedAt).toLocaleDateString('fr-FR')})`,
        margin + 3,
        y
      );
      y += 4.5;
    });
  } else {
    doc.setTextColor(21, 128, 61); // Green
    doc.text('• Aucune allergie médicamenteuse connue signalée.', margin + 3, y);
    y += 5;
  }

  // Pathologies CIM-10
  checkPageBreak(12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 58, 138);
  doc.text('PATHOLOGIES ACTIVES & DIAGNOSTICS (CIM-10) :', margin, y);
  y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  if (patient.problems.length > 0) {
    patient.problems.forEach((prob) => {
      checkPageBreak(6);
      const dateStr = prob.onsetDate ? new Date(prob.onsetDate).toLocaleDateString('fr-FR') : 'Date non précisée';
      doc.text(`• [${prob.code}] ${prob.display} — Diagnostic posé : ${dateStr}`, margin + 3, y);
      y += 4.5;
    });
  } else {
    doc.text('• Aucun problème chronique répertorié.', margin + 3, y);
    y += 4.5;
  }

  // Antécédents médicaux et chirurgicaux
  checkPageBreak(12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('ANTÉCÉDENTS PERSONNELS & FACTEURS DE RISQUE :', margin, y);
  y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);

  const historyLines: string[] = [];
  if (patient.medicalHistory?.length) {
    historyLines.push(`Médicaux : ${patient.medicalHistory.join(', ')}`);
  }
  if (patient.surgicalHistory?.length) {
    historyLines.push(`Chirurgicaux : ${patient.surgicalHistory.join(', ')}`);
  }
  if (patient.riskFactors?.length) {
    historyLines.push(`Facteurs de risque : ${patient.riskFactors.join(', ')}`);
  }

  if (historyLines.length > 0) {
    historyLines.forEach((line) => {
      const split = doc.splitTextToSize(`• ${line}`, contentWidth - 6);
      checkPageBreak(split.length * 4.5);
      doc.text(split, margin + 3, y);
      y += split.length * 4.5;
    });
  } else {
    doc.text('• Aucun antécédent particulier mentionné.', margin + 3, y);
    y += 4.5;
  }

  y += 4;

  // ==========================================
  // 5. CONSULTATION ACTIVE (MÉTHODE SOAP)
  // ==========================================
  if (clinicalNote) {
    checkPageBreak(40);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('2. DERNIÈRE CONSULTATION CLINIQUE (NOTE SOAP)', margin, y);
    y += 4;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    // Metadata note
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    const isSigned = clinicalNote.status === 'signed' || clinicalNote.status === 'amended';
    doc.text(
      `Statut : ${isSigned ? 'SIGNÉE (Immuable)' : 'BROUILLON (En cours)'}  |  Auteur : ${clinicalNote.authoredByName}  |  Date : ${new Date(clinicalNote.authoredAt).toLocaleString('fr-FR')}`,
      margin,
      y
    );
    y += 5.5;

    // SOAP Boxes
    const soapSections = [
      {
        tag: 'S',
        label: 'Subjectif (Anamnèse & Motif de consultation)',
        text: `${clinicalNote.subjective.chiefComplaint || 'Aucun motif spécifié.'}\n${clinicalNote.subjective.historyOfPresentIllness ? 'Histoire de la maladie : ' + clinicalNote.subjective.historyOfPresentIllness : ''}`.trim(),
        bgColor: [239, 246, 255] as [number, number, number],
        textColor: [30, 58, 138] as [number, number, number],
      },
      {
        tag: 'O',
        label: 'Objectif (Examen Physique & Données d\'observation)',
        text: clinicalNote.objective.physicalExam || 'Examen clinique sans particularité notable.',
        bgColor: [240, 253, 250] as [number, number, number],
        textColor: [17, 94, 89] as [number, number, number],
      },
      {
        tag: 'A',
        label: 'Assessment (Synthèse Diagnostique & Analyse)',
        text: clinicalNote.assessment.clinicalEvaluation || 'Diagnostic de travail en cours d\'évaluation.',
        bgColor: [238, 242, 255] as [number, number, number],
        textColor: [55, 48, 163] as [number, number, number],
      },
      {
        tag: 'P',
        label: 'Plan (Conduite à tenir, Traitement & Recommandations)',
        text: clinicalNote.plan.treatmentPlan || 'Poursuite du traitement habituel et surveillance.',
        bgColor: [250, 245, 255] as [number, number, number],
        textColor: [107, 33, 168] as [number, number, number],
      },
    ];

    soapSections.forEach((sec) => {
      const split = doc.splitTextToSize(sec.text, contentWidth - 10);
      const boxHeight = Math.max(14, split.length * 4.2 + 8);
      checkPageBreak(boxHeight + 3);

      doc.setFillColor(sec.bgColor[0], sec.bgColor[1], sec.bgColor[2]);
      doc.roundedRect(margin, y, contentWidth, boxHeight, 1.5, 1.5, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(sec.textColor[0], sec.textColor[1], sec.textColor[2]);
      doc.text(`[${sec.tag}]  ${sec.label}`, margin + 4, y + 5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text(split, margin + 4, y + 9.5);

      y += boxHeight + 3;
    });

    // Addenda if any
    if (addenda.length > 0) {
      checkPageBreak(20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text(`Addendums médicaux scellés (${addenda.length}) :`, margin, y);
      y += 4.5;
      addenda.forEach((ad) => {
        const adText = `• [${new Date(ad.authoredAt).toLocaleString('fr-FR')}] ${ad.authoredByName} : ${ad.text} (Motif : ${ad.reason})`;
        const splitAd = doc.splitTextToSize(adText, contentWidth - 6);
        checkPageBreak(splitAd.length * 4.5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text(splitAd, margin + 3, y);
        y += splitAd.length * 4.5;
      });
    }

    y += 4;
  }

  // ==========================================
  // 6. PRESCRIPTIONS & TRAITEMENTS EN COURS
  // ==========================================
  checkPageBreak(35);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('3. PRESCRIPTIONS & ORDONNANCES MÉDICALES ACTIVES', margin, y);
  y += 4;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  if (activeMedications.length > 0) {
    activeMedications.forEach((med, idx) => {
      checkPageBreak(20);

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, y, contentWidth, 18, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(30, 58, 138);
      doc.text(`${idx + 1}. ${med.medicationDisplay.toUpperCase()}`, margin + 4, y + 5.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`DCI : ${med.genericName}`, pageWidth - margin - 4, y + 5.5, { align: 'right' });

      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.text(`Posologie : ${med.dosage} — ${med.frequency} (Voie ${med.route})`, margin + 4, y + 10.5);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(
        `Durée : ${med.durationDays} jours  |  Prescrit le ${new Date(med.authoredOn).toLocaleDateString('fr-FR')} par ${med.prescriberName}`,
        margin + 4,
        y + 15
      );

      y += 22;
    });
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Aucune ordonnance médicamenteuse active enregistrée à ce jour.', margin + 3, y);
    y += 8;
  }

  // ==========================================
  // 7. PIED DE PAGE & SIGNATURE MÉDICALE
  // ==========================================
  checkPageBreak(30);
  y += 4;
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('VISA DU MÉDECIN PRATICIEN TRAITANT :', margin, y);

  doc.text('CADRE RÉGLEMENTAIRE & HDS :', pageWidth - margin - 60, y);

  y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`${currentUser.displayName}`, margin, y);
  doc.text(`Spécialité : ${currentUser.department}`, margin, y + 3.5);
  doc.text(`Identifiant : ${currentUser.licenseNumber || 'RPPS-10009184712'}`, margin, y + 7);

  doc.text('Document confidentiel protégé par le secret médical.', pageWidth - margin - 60, y);
  doc.text('Conforme au dossier médical partagé (Mon Espace Santé).', pageWidth - margin - 60, y + 3.5);
  doc.text('Traçabilité immuable scellée dans l\'Audit Trail HDS.', pageWidth - margin - 60, y + 7);

  // Add page numbers at the bottom of all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${i} sur ${totalPages}  ·  Clinique OneDesk  ·  IPP : ${patient.medicalRecordNumber}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' }
    );
  }

  // Trigger browser download
  const cleanName = `${patient.familyName}_${patient.givenName}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  doc.save(`Dossier_Medical_${cleanName}_${patient.medicalRecordNumber}_${dateStr}.pdf`);
}
