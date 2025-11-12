// SMILES di molecole reali comuni
export const moleculeSMILES = [
  "CC(=O)OC1=CC=CC=C1C(=O)O", // Aspirina
  "CN1C=NC2=C1C(=O)N(C(=O)N2C)C", // Caffeina
  "CC(C)CC1=CC=C(C=C1)C(C)C(=O)O", // Ibuprofene
  "CC(=O)NC1=CC=C(C=C1)O", // Paracetamolo
  "C1=CC=C(C=C1)C=O", // Benzaldeide
  "CC(C)NCC(COC1=CC=CC=C1)O", // Propranololo
  "CN(C)CCC=C1C2=CC=CC=C2CCC3=CC=CC=C13", // Amitriptilina
  "CC1=CC=C(C=C1)C(=O)O", // Acido p-toluico
  "C1=CC=C2C(=C1)C(=CN2)CCN", // Triptamina
  "CC(C)CC1=CC=C(C=C1)C(C)C", // p-Cimene
  "COC1=CC=CC=C1O", // Guaiacolo
  "C1=CC(=CC=C1O)O", // Idrochinone
  "C1=CC=C(C=C1)N", // Anilina
  "CC(C)C1=CC=CC=C1", // Cumene
  "C1=CC=C(C=C1)Cl", // Clorobenzene
  "CC1=CC=CC=C1C", // o-Xilene
  "C1=CC=C(C=C1)C(=O)C2=CC=CC=C2", // Benzofenone
  "C1=CC=C(C=C1)C#N", // Benzonitrile
  "CC1=CC=C(C=C1)N(=O)=O", // p-Nitrotoluene
  "C1=CC=C(C=C1)S", // Tiofenolo
  "CC(C)(C)C1=CC=C(C=C1)O", // 4-tert-Butilfenolo
  "C1=CC=C(C=C1)C(=O)OC", // Benzoato di metile
  "CC1=CC=C(C=C1)C=C", // p-Metilstirene
  "C1=CC=C(C=C1)CC(=O)O", // Acido fenilacetico
  "CC(C)OC(=O)C1=CC=CC=C1", // Benzoato di isopropile
  "C1=CC=C2C(=C1)C=CC=C2", // Naftalene
  "CC1=CC2=C(C=C1)C=CC=C2", // 2-Metilnaftalene
  "C1=CC=C(C=C1)COC2=CC=CC=C2", // Benzil fenil etere
  "CC(C)C1=CC=C(C=C1)CC(C)C", // p-Diisopropilbenzene
  "C1=CC=C(C=C1)C(C)(C)C", // tert-Butilbenzene
];

// Funzione per ottenere N molecole casuali uniche
export function getRandomMolecules(count = 25) {
  const shuffled = [...moleculeSMILES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
