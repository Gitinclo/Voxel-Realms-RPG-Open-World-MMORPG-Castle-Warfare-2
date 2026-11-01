/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BioscienceTargetProfile, ProteinResiduePoint } from '../types';

/**
 * Canonical 4-band AlphaFold pLDDT confidence color scale from the `science` skill:
 * - Very High (> 90): #0053D6 (Deep Blue)
 * - Confident (70 - 90): #65CBF3 (Light Blue)
 * - Low (50 - 70): #FFDB13 (Yellow)
 * - Very Low (< 50): #FF7D45 (Orange)
 */
export function getAlphaFoldPlddtColor(plddt: number): {
  hex: string;
  hexNumber: number;
  bandLabel: 'Very High (>90)' | 'Confident (70-90)' | 'Low (50-70)' | 'Very Low (<50)';
} {
  if (plddt > 90) {
    return { hex: '#0053D6', hexNumber: 0x0053d6, bandLabel: 'Very High (>90)' };
  }
  if (plddt >= 70) {
    return { hex: '#65CBF3', hexNumber: 0x65cbf3, bandLabel: 'Confident (70-90)' };
  }
  if (plddt >= 50) {
    return { hex: '#FFDB13', hexNumber: 0xffdb13, bandLabel: 'Low (50-70)' };
  }
  return { hex: '#FF7D45', hexNumber: 0xff7d45, bandLabel: 'Very Low (<50)' };
}

function generateHelixBackboneResidues(
  count: number,
  domainName: string,
  basePlddt: number,
  hotspotIdx: number,
  hotspotNote: string,
): ProteinResiduePoint[] {
  const aas = ['ALA', 'ARG', 'ASN', 'ASP', 'CYS', 'GLN', 'GLU', 'GLY', 'HIS', 'ILE', 'LEU', 'LYS', 'MET', 'PHE', 'PRO', 'SER', 'THR', 'TRP', 'TYR', 'VAL'];
  const points: ProteinResiduePoint[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 4.5;
    const isTerminalLoop = i < 4 || i > count - 5;
    const plddt = isTerminalLoop
      ? Math.max(38, basePlddt - 38)
      : Math.min(98.5, basePlddt + Math.sin(i * 0.7) * 6);
    const radius = isTerminalLoop ? 0.24 : 0.18 + Math.sin(i * 0.25) * 0.04;
    points.push({
      residueIndex: i + 1,
      aminoAcid: aas[i % aas.length],
      domainName: isTerminalLoop ? 'Disordered IDR Loop' : domainName,
      plddt: Number(plddt.toFixed(1)),
      x: Number((Math.cos(t) * radius).toFixed(3)),
      y: Number((((i - count / 2) / count) * 0.55).toFixed(3)),
      z: Number((Math.sin(t) * radius).toFixed(3)),
      isMutationHotspot: i === hotspotIdx,
      clinicalVariantNote: i === hotspotIdx ? hotspotNote : undefined,
    });
  }
  return points;
}

export const BIOSCIENCE_TARGETS: Record<string, BioscienceTargetProfile> = {
  TP53: {
    symbol: 'TP53',
    uniprotId: 'P04637',
    pdbId: '1TUP',
    proteinName: 'Cellular tumor antigen p53 (Guardian of the Genome)',
    organism: 'Homo sapiens (TaxID: 9606)',
    sequenceLength: 393,
    meanPlddt: 86.4,
    provenance: '[Predicted by model]',
    alphafoldUrl: 'https://alphafold.ebi.ac.uk/entry/P04637',
    rcsbUrl: 'https://www.rcsb.org/structure/1TUP',
    uniprotUrl: 'https://www.uniprot.org/uniprotkb/P04637',
    chemblLigandName: 'APR-246 (Eprenetapopt · ChEMBL2105729)',
    chemblIc50Nm: 120,
    elixirBuffSummary: 'Immortal Marrow DNA-Repair Elixir: +35% Tribulation Lightning Resistance & +25% Body Cultivation Rate',
    residues: generateHelixBackboneResidues(
      36,
      'p53 DNA-Binding Core Domain (PF00870)',
      93.2,
      17,
      'p.Arg175His (rs28934578) — ClinVar Pathogenic Hotspot in Zinc-Binding Loop',
    ),
  },
  BRCA1: {
    symbol: 'BRCA1',
    uniprotId: 'P38398',
    pdbId: '1JM7',
    proteinName: 'Breast cancer type 1 susceptibility protein (RING & BRCT Domains)',
    organism: 'Homo sapiens (TaxID: 9606)',
    sequenceLength: 1863,
    meanPlddt: 78.9,
    provenance: '[Predicted by model]',
    alphafoldUrl: 'https://alphafold.ebi.ac.uk/entry/P38398',
    rcsbUrl: 'https://www.rcsb.org/structure/1JM7',
    uniprotUrl: 'https://www.uniprot.org/uniprotkb/P38398',
    chemblLigandName: 'Olaparib (PARP Synthetic Lethality · ChEMBL521686)',
    chemblIc50Nm: 5,
    elixirBuffSummary: 'Homologous Recombination Soul Nectar: +40% Soul Force Precision & +15% Breakthrough Success',
    residues: generateHelixBackboneResidues(
      36,
      'BRCA1 RING Finger & BRCT Tandem Domain (PF00533)',
      89.5,
      11,
      'p.Cys61Gly (rs28897672) — ClinVar Pathogenic RING Zn2+ Coordination Variant',
    ),
  },
  EGFR: {
    symbol: 'EGFR',
    uniprotId: 'P00533',
    pdbId: '1M17',
    proteinName: 'Epidermal growth factor receptor (Tyrosine Kinase Domain)',
    organism: 'Homo sapiens (TaxID: 9606)',
    sequenceLength: 1210,
    meanPlddt: 91.2,
    provenance: '[Experimentally determined]',
    alphafoldUrl: 'https://alphafold.ebi.ac.uk/entry/P00533',
    rcsbUrl: 'https://www.rcsb.org/structure/1M17',
    uniprotUrl: 'https://www.uniprot.org/uniprotkb/P00533',
    chemblLigandName: 'Osimertinib (AZD9291 · ChEMBL3353410)',
    chemblIc50Nm: 12,
    elixirBuffSummary: 'Kinase Signal Transduction Pill: +45% Legion March Velocity & +30% Qi Absorption Speed',
    residues: generateHelixBackboneResidues(
      36,
      'Protein Tyrosine Kinase Catalytic Pocket (PF07714)',
      94.8,
      22,
      'p.Thr790Met (rs121434569) — ATP-Binding Gatekeeper Resistance Mutation',
    ),
  },
  HBB: {
    symbol: 'HBB',
    uniprotId: 'P68871',
    pdbId: '4HHB',
    proteinName: 'Hemoglobin subunit beta (Oxygen Transport Tetramer)',
    organism: 'Homo sapiens (TaxID: 9606)',
    sequenceLength: 147,
    meanPlddt: 96.4,
    provenance: '[Experimentally determined]',
    alphafoldUrl: 'https://alphafold.ebi.ac.uk/entry/P68871',
    rcsbUrl: 'https://www.rcsb.org/structure/4HHB',
    uniprotUrl: 'https://www.uniprot.org/uniprotkb/P68871',
    chemblLigandName: 'Voxelotor (GBT-440 · ChEMBL3707348)',
    chemblIc50Nm: 35,
    elixirBuffSummary: 'Heme Oxygen-Transport Blood Essence: +50% Shieldbearer Vitality & +35% Blood Essence Tempering',
    residues: generateHelixBackboneResidues(
      36,
      'Globin Heme-Binding Fold (PF00042)',
      96.4,
      6,
      'p.Glu6Val (rs334) — Classical Sickle-Cell HBB Hydrophobic Patch Variant',
    ),
  },
};

export function getBioscienceTarget(symbolOrAccession: string): BioscienceTargetProfile {
  const key = symbolOrAccession.trim().toUpperCase();
  if (BIOSCIENCE_TARGETS[key]) return BIOSCIENCE_TARGETS[key];
  const byUniprot = Object.values(BIOSCIENCE_TARGETS).find(
    (t) => t.uniprotId.toUpperCase() === key || t.pdbId.toUpperCase() === key,
  );
  return byUniprot || BIOSCIENCE_TARGETS.TP53;
}
