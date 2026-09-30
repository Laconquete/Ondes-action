import { jsPDF } from 'jspdf';
import {
  Patient,
  ClinicalNote,
  ClinicalAddendum,
  MedicationOrder,
  AppUser,
  VitalSignSet,
} from '../types/clinical';

interface ExportPatientFicheOptions {
  patient: Patient;
  clinicalNote?: ClinicalNote;
  addenda?: ClinicalAddendum[];
  activeMedications?: MedicationOrder[];
  vitalsHistory?: VitalSignSet[];
  currentUser: AppUser;
  // Logo de l'établissement (pas le logo OneDesk — c'est juste le nom du logiciel)
  // En production : l'admin configure le logo de la clinique dans les settings
  hospitalLogoUrl?: string;
  hospitalName?: string;
  hospitalAddress?: string;
  hospitalPhone?: string;
}

/**
 * Export PDF — Fiche de données patient (format A4, style formulaire médical)
 *
 * Inspiré du modèle "5-Fiche-de-donnees-de-contact-du-patient-sur-une-page"
 * Structure :
 *  - En-tête bleu foncé avec logo de l'établissement + nom de l'hôpital
 *  - Section 1 : Identité du patient (titre, nom, prénom, naissance, genre)
 *  - Section 2 : Adresse et contact (adresse, téléphone, email, contact urgence)
 *  - Section 3 : Assurance (fournisseur, numéro, type)
 *  - Section 4 : Antécédents médicaux et chirurgicaux
 *  - Section 5 : Médications actuelles
 *  - Section 6 : Allergies
 *  - Section 7 : Antécédents familiaux
 *  - Section 8 : Constantes vitales (dernières mesures)
 *  - Pied de page : mention confidentialité + date export + logiciel OneDesk
 */
export function exportPatientFichePdf({
  patient,
  clinicalNote,
  addenda = [],
  activeMedications = [],
  vitalsHistory = [],
  currentUser,
  hospitalLogoUrl,
  hospitalName = 'Clinique OneDesk',
  hospitalAddress,
  hospitalPhone,
}: ExportPatientFicheOptions): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  // ============================================================
  // EN-TÊTE — Bande bleu foncé avec logo établissement + nom
  // ============================================================
  const headerHeight = 28;
  doc.setFillColor(15, 40, 80); // Bleu marine foncé
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  // Logo de l'établissement (si fourni, sinon on l'ignore)
  if (hospitalLogoUrl) {
    try {
      // jsPDF addImage nécessite une image en base64 ou URL
      // Pour les logos distants, il faut d'abord les convertir en base64
      // Pour l'instant on affiche juste le nom
    } catch (e) {
      // Logo non disponible, on continue
    }
  }

  // Nom de l'établissement en blanc
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(hospitalName, margin + 4, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  if (hospitalAddress) {
    doc.text(hospitalAddress, margin + 4, 17);
  }
  if (hospitalPhone) {
    doc.text(`Tél: ${hospitalPhone}`, margin + 4, 21);
  }

  // Référence IPP à droite
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`IPP: ${patient.medicalRecordNumber}`, pageWidth - margin - 4, 12, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`Exporté le ${new Date().toLocaleDateString('fr-FR')}`, pageWidth - margin - 4, 17, { align: 'right' });
  doc.text(`par ${currentUser.displayName}`, pageWidth - margin - 4, 21, { align: 'right' });

  y = headerHeight + 6;

  // ============================================================
  // TITRE DU DOCUMENT
  // ============================================================
  doc.setTextColor(15, 40, 80);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('FICHE DE DONNÉES DU PATIENT', pageWidth / 2, y, { align: 'center' });
  y += 6;

  // Ligne séparatrice
  doc.setDrawColor(15, 40, 80);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // ============================================================
  // SECTION 1 — IDENTITÉ
  // ============================================================
  y = drawSectionHeader(doc, 'IDENTITÉ DU PATIENT', y, margin, contentWidth);

  // Grille 2 colonnes
  const col1 = margin + 2;
  const col2 = pageWidth / 2 + 2;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);

  // Ligne 1 : Nom / Prénom
  drawLabelValue(doc, 'Nom:', patient.familyName, col1, y);
  drawLabelValue(doc, 'Prénom:', patient.givenName, col2, y);
  y += 6;

  // Ligne 2 : Date de naissance / Genre
  drawLabelValue(doc, 'Date de naissance:', new Date(patient.birthDate).toLocaleDateString('fr-FR'), col1, y);
  const genderLabel = patient.gender === 'M' ? 'Masculin' : patient.gender === 'F' ? 'Féminin' : 'Autre';
  drawLabelValue(doc, 'Genre:', genderLabel, col2, y);
  y += 6;

  // Ligne 3 : Groupe sanguin / Statut
  drawLabelValue(doc, 'Groupe sanguin:', patient.bloodGroup || 'Non renseigné', col1, y);
  drawLabelValue(doc, 'Statut:', patient.status === 'active' ? 'Actif' : patient.status, col2, y);
  y += 6;

  // Ligne 4 : Médecin traitant
  drawLabelValue(doc, 'Médecin traitant:', patient.primaryDoctorName || 'Non assigné', col1, y);
  if (patient.isReserved) {
    drawLabelValue(doc, 'Réservé par:', patient.reservedByName || '—', col2, y);
  } else {
    drawLabelValue(doc, 'Dernière visite:', patient.lastVisitDate ? new Date(patient.lastVisitDate).toLocaleDateString('fr-FR') : 'Jamais', col2, y);
  }
  y += 7;

  // ============================================================
  // SECTION 2 — ADRESSE ET CONTACT
  // ============================================================
  y = drawSectionHeader(doc, 'ADRESSE ET CONTACT', y, margin, contentWidth);

  drawLabelValue(doc, 'Adresse:', `${patient.address.street} ${patient.address.postalCode} ${patient.address.city}`, col1, y);
  drawLabelValue(doc, 'Téléphone:', patient.phone || 'Non renseigné', col2, y);
  y += 6;

  drawLabelValue(doc, 'Email:', patient.email || 'Non renseigné', col1, y);
  drawLabelValue(doc, 'Profession:', '—', col2, y);
  y += 6;

  // Contact d'urgence
  drawLabelValue(doc, 'Contact urgence:', `${patient.emergencyContact.name} (${patient.emergencyContact.relationship})`, col1, y);
  drawLabelValue(doc, 'Tél urgence:', patient.emergencyContact.phone || 'Non renseigné', col2, y);
  y += 7;

  // ============================================================
  // SECTION 3 — ASSURANCE
  // ============================================================
  y = drawSectionHeader(doc, 'ASSURANCE', y, margin, contentWidth);

  drawLabelValue(doc, 'Fournisseur:', patient.insurance.provider, col1, y);
  drawLabelValue(doc, 'Numéro police:', patient.insurance.policyNumber, col2, y);
  y += 7;

  // ============================================================
  // SECTION 4 — ANTÉCÉDENTS MÉDICAUX
  // ============================================================
  y = drawSectionHeader(doc, 'ANTÉCÉDENTS MÉDICAUX', y, margin, contentWidth);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  if (patient.medicalHistory.length > 0) {
    patient.medicalHistory.forEach((item) => {
      doc.text(`• ${item}`, col1, y);
      y += 4.5;
    });
  } else {
    doc.setTextColor(120, 120, 120);
    doc.text('Aucun antécédent enregistré', col1, y);
    doc.setTextColor(0, 0, 0);
    y += 4.5;
  }

  if (patient.surgicalHistory && patient.surgicalHistory.length > 0) {
    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Chirurgicaux:', col1, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    patient.surgicalHistory.forEach((item) => {
      doc.text(`• ${item}`, col1, y);
      y += 4.5;
    });
  }
  y += 4;

  // ============================================================
  // SECTION 5 — ALLERGIES
  // ============================================================
  y = drawSectionHeader(doc, 'ALLERGIES', y, margin, contentWidth);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const activeAllergies = patient.allergies.filter((a) => a.status === 'active');
  if (activeAllergies.length > 0) {
    activeAllergies.forEach((allergy) => {
      // Couleur rouge pour les allergies critiques
      if (allergy.severity === 'critical' || allergy.severity === 'life_threatening') {
        doc.setTextColor(180, 0, 0);
        doc.text(`⚠ ${allergy.substanceDisplay} (${allergy.severity})`, col1, y);
        doc.setTextColor(0, 0, 0);
      } else {
        doc.text(`• ${allergy.substanceDisplay} (${allergy.severity})`, col1, y);
      }
      y += 4.5;
    });
  } else {
    doc.setTextColor(0, 120, 0);
    doc.text('✓ Aucune allergie connue', col1, y);
    doc.setTextColor(0, 0, 0);
    y += 4.5;
  }
  y += 4;

  // ============================================================
  // SECTION 6 — PROBLÈMES ACTIFS (diagnostics)
  // ============================================================
  y = drawSectionHeader(doc, 'PROBLÈMES ACTIFS (CIM-10)', y, margin, contentWidth);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const activeProblems = patient.problems.filter((p) => p.clinicalStatus === 'active');
  if (activeProblems.length > 0) {
    activeProblems.forEach((problem) => {
      doc.text(`• [${problem.code}] ${problem.display}`, col1, y);
      y += 4.5;
    });
  } else {
    doc.setTextColor(120, 120, 120);
    doc.text('Aucun problème actif', col1, y);
    doc.setTextColor(0, 0, 0);
    y += 4.5;
  }
  y += 4;

  // ============================================================
  // SECTION 7 — MÉDICAMENTS ACTIFS
  // ============================================================
  y = drawSectionHeader(doc, 'MÉDICAMENTS ACTIFS', y, margin, contentWidth);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  if (activeMedications.length > 0) {
    activeMedications.forEach((med) => {
      doc.text(`• ${med.medicationDisplay} — ${med.dosage}, ${med.frequency}, ${med.route}`, col1, y);
      y += 4.5;
    });
  } else {
    doc.setTextColor(120, 120, 120);
    doc.text('Aucune médication active', col1, y);
    doc.setTextColor(0, 0, 0);
    y += 4.5;
  }
  y += 4;

  // ============================================================
  // SECTION 8 — DERNIÈRES CONSTANTES VITALES
  // ============================================================
  y = drawSectionHeader(doc, 'DERNIÈRES CONSTANTES VITALES', y, margin, contentWidth);

  const latestVitals = vitalsHistory?.[vitalsHistory.length - 1];
  if (latestVitals) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const vitalsDate = new Date(latestVitals.measuredAt).toLocaleDateString('fr-FR');

    drawLabelValue(doc, 'Tension:', latestVitals.systolic && latestVitals.diastolic ? `${latestVitals.systolic}/${latestVitals.diastolic} mmHg` : '—', col1, y);
    drawLabelValue(doc, 'Pouls:', latestVitals.pulseBpm ? `${latestVitals.pulseBpm} bpm` : '—', col2, y);
    y += 5;

    drawLabelValue(doc, 'Poids:', latestVitals.weightKg ? `${latestVitals.weightKg} kg` : '—', col1, y);
    drawLabelValue(doc, 'IMC:', latestVitals.bmi ? latestVitals.bmi.toString() : '—', col2, y);
    y += 5;

    drawLabelValue(doc, 'Température:', latestVitals.temperatureC ? `${latestVitals.temperatureC}°C` : '—', col1, y);
    drawLabelValue(doc, 'SpO₂:', latestVitals.oxygenSaturation ? `${latestVitals.oxygenSaturation}%` : '—', col2, y);
    y += 5;

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.text(`Mesurées le ${vitalsDate} par ${latestVitals.measuredBy}`, col1, y);
    doc.setFont('helvetica', 'normal');
    y += 6;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('Aucune constante vitale enregistrée', col1, y);
    doc.setTextColor(0, 0, 0);
    y += 6;
  }

  // ============================================================
  // PIED DE PAGE — Confidentialité + mention logiciel
  // ============================================================
  const footerY = pageHeight - 18;

  // Ligne séparatrice
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY, pageWidth - margin, footerY);

  doc.setTextColor(120, 120, 120);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(
    'DOCUMENT CONFIDENTIEL — Données médicales protégées (RGPD/CNIL). Ne pas diffuser sans autorisation.',
    margin,
    footerY + 4
  );
  doc.text(
    `Généré par OneDesk Clinique v1.0.0 · ${new Date().toLocaleString('fr-FR')}`,
    margin,
    footerY + 8
  );
  doc.text('Fabricefb / MyEventprod', pageWidth - margin, footerY + 8, { align: 'right' });

  // ============================================================
  // SAUVEGARDE
  // ============================================================
  const fileName = `Fiche_Patient_${patient.familyName}_${patient.medicalRecordNumber}.pdf`;
  doc.save(fileName);
}

// ============================================================
// HELPERS
// ============================================================

function drawSectionHeader(
  doc: jsPDF,
  title: string,
  y: number,
  margin: number,
  width: number
): number {
  // Fond bleu clair
  doc.setFillColor(230, 243, 255); // Bleu très clair
  doc.rect(margin, y, width, 6, 'F');

  // Bordure gauche bleu foncé
  doc.setFillColor(15, 40, 80);
  doc.rect(margin, y, 1.5, 6, 'F');

  // Texte
  doc.setTextColor(15, 40, 80);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(title, margin + 4, y + 4.2);

  doc.setTextColor(0, 0, 0); // Reset
  return y + 8;
}

function drawLabelValue(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number
): void {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(label, x, y);

  doc.setFont('helvetica', 'normal');
  const labelWidth = doc.getTextWidth(label) + 2;
  doc.text(value, x + labelWidth, y);
}
