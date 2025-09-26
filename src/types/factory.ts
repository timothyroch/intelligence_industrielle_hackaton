export interface Machine {
  id: number;
  nom: string;
  etat: "Actif" | "En maintenance" | "Hors service";
  derniereMaintenance?: string;
  performance?: number;
  modele?: string;
  firmware?: string;
  adresseIP?: string;
  serie?: string;
}

export interface Departement {
  id: number;
  nom: string;
  machines: Machine[];
}

export interface Site {
  id: number;
  nom: string;
  localisation?: string;
  departements: Departement[];
}
