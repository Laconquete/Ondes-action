import { Allergy, MedicationCatalogItem, MedicationOrder } from '../types/clinical';

/**
 * Service de Matching Allergies basé sur les codes ATC (Anatomical Therapeutic Chemical)
 *
 * Problème résolu : l'ancienne implémentation utilisait `.includes()` sur les noms d'affichage,
 * ce qui provoquait des faux positifs dangereux :
 *   - "pénicillamine" (M01CB02) matchait "pénicilline" (J01CA04) par includes('penicill')
 *   - "codéine" (N02AA01) matchait "codéinethy" par includes()
 *
 * Solution : matching hiérarchique strict sur les codes ATC :
 *   Niveau 1 : 1 lettre  (anatomique — ex: J = anti-infectieux)
 *   Niveau 2 : 2 lettres (thérapeutique — ex: J01 = antibactériens)
 *   Niveau 3 : 3 lettres (pharmacologique — ex: J01C = bêta-lactamines)
 *   Niveau 4 : 4 lettres (sous-groupe — ex: J01CA = pénicillines à large spectre)
 *   Niveau 5 : 5+ lettres (substance — ex: J01CA04 = amoxicilline)
 *
 * Référentiel officiel : WHO Collaborating Centre for Drug Statistics Methodology
 * https://www.whocc.no/atc_ddd_index/
 */

export interface AllergyMatchResult {
  matched: boolean;
  matchType: 'exact_substance' | 'same_pharmacological_class' | 'same_therapeutic_group' | 'none';
  matchedAllergy?: Allergy;
  matchedCode?: string;
  safetyNote: string;
}

/**
 * Normalise un code ATC (uppercase, sans espaces, valide le format).
 * Format attendu : 1 lettre + 2 chiffres + 1 lettre + 2 chiffres (niveau substance)
 * ou préfixe plus court (niveau classe).
 */
export function normalizeAtcCode(code: string | undefined | null): string | null {
  if (!code) return null;
  const trimmed = code.trim().toUpperCase();
  // Format ATC officiel (WHO) :
  //   Niveau 1 (anatomique)       : 1 lettre            ex: J
  //   Niveau 2 (thérapeutique)    : 1 lettre + 2 chiffres ex: J01
  //   Niveau 3 (pharmacologique)  : + 1 lettre            ex: J01C
  //   Niveau 4 (sous-groupe)      : + 1 lettre            ex: J01CA
  //   Niveau 5 (substance)        : + 2 chiffres          ex: J01CA04
  // Soit : [A-Z][0-9]{2}[A-Z]{0,2}[0-9]{0,2}
  // On accepte aussi bien les codes complets que les préfixes partiels.
  if (!/^[A-Z][0-9]{2}(?:[A-Z]{1,2})?(?:[0-9]{2})?$/.test(trimmed)) {
    // Permettre aussi le préfixe court (niveau 2 : J01, niveau 3 : J01C, niveau 4 : J01CA)
    if (/^[A-Z][0-9]{2}$/.test(trimmed)) return trimmed;
    if (/^[A-Z][0-9]{2}[A-Z]$/.test(trimmed)) return trimmed;
    if (/^[A-Z][0-9]{2}[A-Z]{2}$/.test(trimmed)) return trimmed;
    if (/^[A-Z][0-9]{2}[A-Z]{2}[0-9]{2}$/.test(trimmed)) return trimmed;
    return null;
  }
  return trimmed;
}

/**
 * Calcule le niveau hiérarchique d'un code ATC.
 * Plus le niveau est élevé, plus le matching est spécifique.
 */
export function getAtcLevel(code: string): number {
  const normalized = normalizeAtcCode(code);
  if (!normalized) return 0;
  // Niveau 1 : anatomique (1 lettre)
  // Niveau 2 : thérapeutique (1 lettre + 2 chiffres = 3 chars)
  // Niveau 3 : pharmacologique (+ 1 lettre = 4 chars)
  // Niveau 4 : sous-groupe (+ 1 chiffre = 5 chars)
  // Niveau 5 : substance (+ 1 chiffre = 6 chars ou 7 chars)
  if (normalized.length >= 7) return 5; // Code complet substance (avec ddd parfois)
  if (normalized.length === 6) return 5; // Code substance standard
  if (normalized.length === 5) return 4; // Sous-groupe
  if (normalized.length === 4) return 3; // Pharmacologique
  if (normalized.length === 3) return 2; // Thérapeutique
  return 1; // Anatomique
}

/**
 * Vérifie si deux codes ATC partagent un préfixe commun au niveau pharmacologique (niveau 3+).
 * Évite les faux positifs de niveau 1 (anatomique) qui sont trop larges.
 */
export function sharePharmacologicalPrefix(codeA: string, codeB: string): boolean {
  const a = normalizeAtcCode(codeA);
  const b = normalizeAtcCode(codeB);
  if (!a || !b) return false;
  // Niveau pharmacologique = 4 premiers caractères (ex: "J01C" pour bêta-lactamines)
  const prefixLength = 4;
  if (a.length < prefixLength || b.length < prefixLength) return false;
  return a.substring(0, prefixLength) === b.substring(0, prefixLength);
}

/**
 * Vérifie si deux codes ATC correspondent à la même substance exacte.
 */
export function isExactSubstanceMatch(codeA: string, codeB: string): boolean {
  const a = normalizeAtcCode(codeA);
  const b = normalizeAtcCode(codeB);
  if (!a || !b) return false;
  // Substance = 7 caractères minimum
  if (a.length < 7 || b.length < 7) return false;
  return a.substring(0, 7) === b.substring(0, 7);
}

/**
 * Évalue le risque allergologique d'un médicament proposé vis-à-vis du patient.
 *
 * Algorithme strict (remplace `proposedMedication.allergenClasses.some(c => allergyCode.includes(c))`) :
 *   1. Si le code ATC exact de la substance proposée matche un code ATC d'allergie active → CRITICAL
 *   2. Si une classe pharmacologique (niveau 3+) du médicament matche une classe d'allergie → CRITICAL
 *   3. Sinon → pas de match
 *
 * @returns Un résultat indiquant si un match a eu lieu, son type, et la note de sécurité associée.
 */
export function evaluateAllergyRisk(
  patient: { allergies: Allergy[] },
  proposedMedication: MedicationCatalogItem
): AllergyMatchResult[] {
  const results: AllergyMatchResult[] = [];
  const activeAllergies = patient.allergies.filter((a) => a.status === 'active');

  if (activeAllergies.length === 0) {
    return [
      {
        matched: false,
        matchType: 'none',
        safetyNote: 'Aucune allergie active enregistrée pour ce patient.',
      },
    ];
  }

  const proposedAtc = normalizeAtcCode(proposedMedication.atcCode);
  const proposedClassCodes = (proposedMedication.allergenClassCodes || [])
    .map(normalizeAtcCode)
    .filter((c): c is string => c !== null);

  for (const allergy of activeAllergies) {
    const allergyAtc = normalizeAtcCode(allergy.substanceCode);
    const allergyClassCode = normalizeAtcCode(allergy.allergenClassCode);

    // Cas 1 : Match exact sur le code substance ATC
    if (proposedAtc && allergyAtc && isExactSubstanceMatch(proposedAtc, allergyAtc)) {
      results.push({
        matched: true,
        matchType: 'exact_substance',
        matchedAllergy: allergy,
        matchedCode: allergyAtc,
        safetyNote: `Substance identique : le médicament proposé (ATC ${proposedAtc}) correspond exactement à l'allergie enregistrée (${allergy.substanceDisplay}, ATC ${allergyAtc}). Risque de réaction croisée : ${
          allergy.severity === 'critical' || allergy.severity === 'life_threatening'
            ? 'anaphylaxie possible'
            : 'réaction allergique probable'
        }.`,
      });
      continue;
    }

    // Cas 2 : Match sur la classe pharmacologique (niveau 3+ minimum)
    // Ex : amoxicilline (J01CA04) prescrite, patient allergique à ampicilline (J01CA01)
    // → J01CA commun = pénicillines à large spectre → réaction croisée probable
    if (proposedAtc && allergyAtc && sharePharmacologicalPrefix(proposedAtc, allergyAtc)) {
      results.push({
        matched: true,
        matchType: 'same_pharmacological_class',
        matchedAllergy: allergy,
        matchedCode: allergyAtc,
        safetyNote: `Réaction croisée probable : le médicament (ATC ${proposedAtc}) et l'allergie (${allergy.substanceDisplay}, ATC ${allergyAtc}) partagent la même classe pharmacologique (niveau ${getAtcLevel(proposedAtc)}). Contre-indication relative à évaluer cliniquement.`,
      });
      continue;
    }

    // Cas 3 : Match sur la classe pharmacologique déclarée du médicament
    // (utile si le code ATC du médicament n'est pas renseigné mais la classe oui)
    if (proposedClassCodes.length > 0 && allergyClassCode) {
      for (const proposedClass of proposedClassCodes) {
        if (sharePharmacologicalPrefix(proposedClass, allergyClassCode)) {
          results.push({
            matched: true,
            matchType: 'same_pharmacological_class',
            matchedAllergy: allergy,
            matchedCode: allergyClassCode,
            safetyNote: `Classe allergénique partagée : le médicament appartient à la classe ATC ${proposedClass}, qui chevauche l'allergie déclarée (${allergy.substanceDisplay}, classe ${allergyClassCode}). Vérifier la pertinence clinique.`,
          });
          break;
        }
      }
    }

    // Cas 4 : Cas de fallback pour les allergies sans code ATC (legacy data)
    // On NE JAMAIS utiliser `.includes()` sur le display name — on déclare simplement l'incertitude
    if (!allergyAtc && !allergyClassCode) {
      results.push({
        matched: false,
        matchType: 'none',
        matchedAllergy: allergy,
        safetyNote: `Allergie "${allergy.substanceDisplay}" enregistrée sans code ATC — vérification manuelle requise (données legacy à compléter).`,
      });
    }
  }

  // Si aucun match, on ajoute un résultat "safe"
  if (!results.some((r) => r.matched)) {
    results.push({
      matched: false,
      matchType: 'none',
      safetyNote: `Aucune réaction croisée identifiée avec les ${activeAllergies.length} allergie(s) active(s) du patient (matching ATC strict).`,
    });
  }

  return results;
}

/**
 * Vérifie qu'un médicament peut être prescrit sans risquer d'anaphylaxie.
 *
 * @returns true si la prescription est sécurisée (pas d'allergie critique en match exact)
 */
export function isPrescriptionSafeRegardingAllergies(
  patient: { allergies: Allergy[] },
  proposedMedication: MedicationCatalogItem
): { safe: boolean; blockingReason?: string } {
  const matches = evaluateAllergyRisk(patient, proposedMedication);
  const blockingMatch = matches.find(
    (m) =>
      m.matched &&
      (m.matchType === 'exact_substance' || m.matchType === 'same_pharmacological_class') &&
      m.matchedAllergy &&
      (m.matchedAllergy.severity === 'critical' ||
        m.matchedAllergy.severity === 'life_threatening')
  );

  if (blockingMatch) {
    return {
      safe: false,
      blockingReason: blockingMatch.safetyNote,
    };
  }
  return { safe: true };
}

/**
 * Extrait le code ATC d'une ordonnance existante (MedicationOrder).
 * Pour les ordonnances sans ATC (legacy), retourne null et force la vérification manuelle.
 */
export function extractAtcFromOrder(order: MedicationOrder): string | null {
  // Si l'ordonnance a un champ atcCode, on l'utilise (à étendre dans le type)
  // Pour l'instant, on retourne null pour les ordonnances legacy sans ATC
  const orderWithAtc = order as MedicationOrder & { atcCode?: string };
  return normalizeAtcCode(orderWithAtc.atcCode);
}
