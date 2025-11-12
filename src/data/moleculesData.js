// SMILES di molecole reali comuni
export const moleculeSMILES = [
  // Farmaci complessi
  "CC1=C(C(=O)N(C2=CC=CC=C12)C3=CC=CC=C3C(=O)O)CC(=O)O", // Indometacina
  "CN1C2CCC1CC(C2)OC(=O)C(CO)C3=CC=CC=C3", // Atropina
  "CN1CCC23C4C1CC5=C2C(=C(C=C5)O)OC3C(C=C4)O", // Morfina
  "CC(C)CC1=CC=C(C=C1)C(C)C(=O)OC2C(C(C(C(O2)CO)O)O)O", // Ibuprofene glicoside
  "CC(=O)OC1=CC=CC=C1C(=O)OC2=CC=CC=C2C(=O)O", // Aspirina dimer

  // Antibiotici
  "CC1(C2CCC3(C(C2(CC1O)C)CCC4C3(CCC5C4(CCC(C5(C)C)O)C)C)C)C", // Acido oleanolico
  "CC1C2C(C(C(O2)OC3C(C(C(C(C3O)NC)OC4C(C(C(CO4)O)O)O)O)O)C)C(C(C1O)(C)O)N", // Kanamicina
  //"CC1CC(C(C(=O)C(CC(C(C(C(C(C(=O)O1)C)OC2CC(C(C(O2)C)O)(C)OC)C)OC3C(C(CC(O3)C)N(C)C)O)(C)O)C)C)O)(C)O", // Eritromicina

  // Steroidi e ormoni
  "CC12CCC(=O)C=C1CCC3C2CCC4(C3CCC4(C)O)C", // Testosterone
  "CC12CCC3C(C1CCC2O)CCC4=CC(=O)CCC34C", // Estrone
  "CC(C)C1CCC(C)C(C1)C2CCC3C2(CCC4C3CC=C5C4(CCC(C5)O)C)C", // Colesterolo

  // Alcaloidi
  "CN1C=NC2=C1C(=O)N(C(=O)N2C)C3CC3", // Teofillina ciclopropanica
  "C1CN(CCC1N2C3=CC=CC=C3C4=C2C=C(C=C4)Cl)CCCC(=O)O", // Clozapina acido
  "COC1=C(C=C2C(=C1)C(C3=CC=CC=C3C2=O)C(=O)C4=CC=CC=C4)OC", // Flavone complesso

  // Coloranti e cromofori
  "CC1=CC=C(C=C1)N=NC2=CC=C(C=C2)N(C)C", // Metil arancio
  "C1=CC(=CC=C1C2=C(C(=O)C3=C(C=C(C=C3O2)O)O)O)O", // Quercetina
  "COC1=C(C=CC(=C1)C=CC(=O)CC(=O)C=CC2=CC(=C(C=C2)O)OC)O", // Curcumina

  // Molecole bioattive
  "CC(C)C1=NC(=CS1)CN(C)C(=O)N2CCCC(C2)N3C4=C(C(=O)C(=CN4C=N3)C(=O)NCC5=NC=C(N5)C)F", // Voriconazolo
  "CC1=C(SC=[N+]1CC2=CN=C(N=C2N)C)CCOP(=O)([O-])OP(=O)(O)O", // Tiamina pirofosfato

  // Prodotti naturali
  "CC1=CC(=C(C(=C1)C)C2=C(C(=O)C3=C(C=C(C=C3O2)OC)O)OC)C", // Polimetossiflavone
  "C1CC(CCC1N)C2=CC=C(C=C2)O", // Tiramina cicloesilica
  "CC(C)(C)C1=CC=C(C=C1)C(=O)C2=CC=C(C=C2)C(C)(C)C", // Bis-tert-butilbenzofenone

  // Policiclici
  "C1CCC2=C(C1)C=CC3=C2C=CC4=C3C=CC=C4", // Antracene idrogenato
  "C1=CC=C2C(=C1)C3=CC=CC=C3C4=CC=CC=C24", // Trifenilene
  "C1=CC2=C3C(=C1)C=CC4=CC=CC(=C43)C=C2", // Fluorantene

  // Complessi eterociclici
  "C1CN(CCN1)C2=NC3=CC=CC=C3N2CC4=CC=C(C=C4)Cl", // Benzodiazepina clorata
  "CC1=NN=C(S1)NC(=O)CSC2=NC3=CC=CC=C3N2", // Benzotiazolo complesso
  "C1=CC=C(C=C1)C2=NC3=C(N=CN=C3N2)N", // Adenina fenilica

  // Polimeri bioattivi
  "CC(C)NCC(COC1=CC=C(C=C1)COCCOC2=CC=CC=C2)O", // Beta-bloccante etere
  "CC1=C(C(=NO1)C2=CC=CC=C2)C(=O)NC3=CC=C(C=C3)C#N", // Isossazolo nitrile
  "C1=CC=C(C=C1)C2=CC(=NO2)C3=CC=C(C=C3)Cl", // Ossazolo clorurato
];

{/*
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
  */}

// Funzione per ottenere N molecole casuali uniche
export function getRandomMolecules(count = 25) {
  const shuffled = [...moleculeSMILES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
