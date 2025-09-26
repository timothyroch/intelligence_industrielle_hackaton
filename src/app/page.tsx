"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import rawData from "@/data/factory.json";
import type { Site, Machine } from "@/types/factory";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  Building2,
  Cog,
  Database,
  Factory,
  MapPin,
  Moon,
  Sun,
  Search,
  Settings,
  TrendingUp,
  Wifi,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { Gauge } from "@/components/charts/Gauge";
import { MiniBar } from "@/components/charts/MiniBar";
import { CategoryBar } from "@/components/charts/CategoryBar";
import random from 'random';   

// Présets visuels pour avoir un style cohérent (cartes, cadres, fonds)
const PANEL = "rounded-xl bg-background ring-1 ring-border shadow-sm";
const FRAME = "rounded-lg bg-background ring-1 ring-border";

// Style appliqué à la carte Google Maps
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const MAP_CONTAINER_STYLE: google.maps.MapOptions["styles"] = [
  { elementType: "geometry", stylers: [{ color: "#1f2937" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9ca3af" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#111827" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#334155" }] },
  { featureType: "water", stylers: [{ color: "#0ea5e9" }] },
];

const factoryData = rawData as Site[];

// Styles par état des machines
const STATUS_STYLES: Record<string, string> = {
  Actif:
    "bg-emerald-200 text-emerald-800 ring-1 ring-emerald-300 " +
    "dark:bg-emerald-500/20 dark:text-emerald-200 dark:ring-emerald-400/30",

  "En maintenance":
    "bg-amber-200 text-amber-900 ring-1 ring-amber-300 " +
    "dark:bg-amber-500/20 dark:text-amber-200 dark:ring-amber-400/30",

  "Hors service":
    "bg-rose-300 text-rose-900 ring-1 ring-rose-300 " +
    "dark:bg-rose-500/20 dark:text-rose-200 dark:ring-rose-400/30",
};

const statusBadge = (etat?: string) => STATUS_STYLES[etat ?? ""] ?? "bg-muted text-foreground";

// Générateur pseudo-aléatoire pour des chiffres reproductibles
const makeRng = (seedInput: string | number) => {
  let s =
    typeof seedInput === "string"
      ? [...seedInput].reduce((a, c) => a + c.charCodeAt(0), 0)
      : seedInput;
  return () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32;
    return (s >>> 0) / 2 ** 32;
  };
};

// Gestion simple du thème sombre (pas besoin de provider externe)
function useDarkMode() {
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [dark]);

  return { dark, toggle: () => setDark((d) => !d) };
}

// ---------------------------------------------------------------------------
// Tableau de bord principal
export default function FactoryDashboard() {
  const [search, setSearch] = useState("");
  const [filterEtat, setFilterEtat] = useState<string>("all");

  // NOUVEAU : filtres ville & département
  const [filterCity, setFilterCity] = useState<string>("all");
  const [filterDept, setFilterDept] = useState<string>("all");

  // NOUVEAU : accordéons contrôlés (pour auto-ouvrir)
  const [openSite, setOpenSite] = useState<string | undefined>(undefined);
  const [openDepsBySite, setOpenDepsBySite] = useState<Record<number, string[]>>({});
  
  // Filtrage sites/départements selon ville/département (et on garde la recherche pour l’affichage table)
  const filteredSites = useMemo(() => {
    return factoryData
      .filter((site) => {
        const siteCity = (site.localisation.split(",")[0] || "").trim();
        return filterCity === "all" || siteCity === filterCity;
      })
      .map((site) => ({
        ...site,
        departements: site.departements.filter((d) => filterDept === "all" || d.nom === filterDept),
      }))
      .filter((site) => site.departements.length > 0);
  }, [filterCity, filterDept]);
  // Suggestions de recherche
  const [showSug, setShowSug] = useState(false);
  const [activeIdx, setActiveIdx] = useState<number>(0);

  // Liste aplatie des machines selon filtres Ville/Département/État
  type FlatMachine = {
    id: number;
    nom: string;
    etat: string;
    siteId: number;
    siteNom: string;
    siteLoc: string;
    depId: number;
    depNom: string;
    performance?: number;
  };

  const flatMachines = useMemo<FlatMachine[]>(() => {
    const list: FlatMachine[] = [];
    filteredSites.forEach((site) => {
      site.departements.forEach((dep) => {
        dep.machines.forEach((m) => {
          if (filterEtat !== "all" && m.etat !== filterEtat) return;
          list.push({
            id: m.id,
            nom: m.nom,
            etat: m.etat,
              siteId: site.id,
              siteNom: site.nom,
              siteLoc: site.localisation,
              depId: dep.id,
              depNom: dep.nom,
              performance: (m as any).performance,
          });
        });
      });
    });
    return list;
  }, [filteredSites, filterEtat]);

    // Suggestions en fonction du texte saisi
    const suggestions = useMemo(() => {
      const q = search.trim().toLowerCase();
      if (!q) return [];
      // match sur le nom (contient) + tri simple (nom commence par, puis contient)
      const starts = flatMachines.filter((m) => m.nom.toLowerCase().startsWith(q));
      const contains = flatMachines.filter(
        (m) => !m.nom.toLowerCase().startsWith(q) && m.nom.toLowerCase().includes(q)
      );
      return [...starts, ...contains].slice(0, 8);
    }, [search, flatMachines]);

    // Quand on choisit une suggestion
    const selectSuggestion = (fm: FlatMachine) => {
      setSearch(fm.nom);
      // ouvre site + département
      setOpenSite(`site-${fm.siteId}`);
      setOpenDepsBySite((prev) => ({
        ...prev,
        [fm.siteId]: Array.from(new Set([...(prev[fm.siteId] ?? []), `dep-${fm.depId}`])),
      }));
      // scroll vers la ligne
      setTimeout(() => {
        const el = machineRowRefs.current[fm.id];
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        el?.classList.add("ring-2", "ring-primary/60");
        setTimeout(() => el?.classList.remove("ring-2", "ring-primary/60"), 1200);
      }, 80);
      setShowSug(false);
      setActiveIdx(0);
    };

  // Références pour scroller jusqu’à la machine trouvée
  const machineRowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});

  const prefersReducedMotion = useReducedMotion();
  const { dark, toggle } = useDarkMode();

  // Totaux simples
  const totals = useMemo(() => {
    const sites = factoryData.length;
    const departments = factoryData.reduce((a, b) => a + b.departements.length, 0);
    const machines = factoryData.reduce(
      (a, b) => a + b.departements.reduce((c, d) => c + d.machines.length, 0),
      0,
    );
    return { sites, departments, machines };
  }, []);

  // Options ville/département
  const cityOptions = useMemo(() => {
    const set = new Set<string>();
    factoryData.forEach((s) => {
      // clé ville simple = premier mot avant la virgule (ex: "Montréal")
      const city = (s.localisation.split(",")[0] || "").trim();
      if (city) set.add(city);
    });
    return Array.from(set).sort();
  }, []);

  const deptOptions = useMemo(() => {
    const list = new Set<string>();
    factoryData.forEach((site) => {
      const siteCity = (site.localisation.split(",")[0] || "").trim();
      if (filterCity !== "all" && siteCity !== filterCity) return;
      site.departements.forEach((d) => list.add(d.nom));
    });
    return Array.from(list).sort();
  }, [filterCity]);

  // Filtrage machines (par nom + état)
  const filterMachines = (machines: Machine[]): Machine[] =>
    machines.filter((m) => {
      const matchesSearch = m.nom.toLowerCase().includes(search.toLowerCase());
      const matchesEtat = filterEtat === "all" || m.etat === filterEtat;
      return matchesSearch && matchesEtat;
    });


  // NOUVEAU : ouverture auto du bon site/département + scroll lors d’une recherche
  useEffect(() => {
    if (!search.trim()) return;

    // trouve la 1ère machine correspondant à la recherche et aux filtres ville/dept/etat
    for (const site of filteredSites) {
      for (const dep of site.departements) {
        const match = dep.machines.find((m) =>
          m.nom.toLowerCase().includes(search.toLowerCase()) &&
          (filterEtat === "all" || m.etat === filterEtat)
        );
        if (match) {
          // ouvre le site
          setOpenSite(`site-${site.id}`);
          // ouvre le département
          setOpenDepsBySite((prev) => ({
            ...prev,
            [site.id]: Array.from(new Set([...(prev[site.id] ?? []), `dep-${dep.id}`])),
          }));
          // petit scroll vers la machine après le rendu
          setTimeout(() => {
            const el = machineRowRefs.current[match.id];
            el?.scrollIntoView({ behavior: "smooth", block: "center" });
            el?.classList.add("ring-2", "ring-primary/60");
            setTimeout(() => el?.classList.remove("ring-2", "ring-primary/60"), 1200);
          }, 50);
          return;
        }
      }
    }
  }, [search, filteredSites, filterEtat]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Barre du haut */}
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Factory className="h-6 w-6 text-primary" aria-hidden="true" />
            <div>
              <h1 className="text-lg font-semibold leading-tight tracking-tight md:text-xl">NeoFactory</h1>
              <p className="text-xs text-muted-foreground">Tableau de bord opérationnel</p>
            </div>
          </div>

          {/* Recherche + filtres */}
          <div className="flex flex-1 items-center justify-end gap-3 flex-wrap">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Rechercher une machine"
              placeholder="Rechercher une machine…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowSug(true);
                setActiveIdx(0);
              }}
              onFocus={() => search.trim() && setShowSug(true)}
              onBlur={() => setTimeout(() => setShowSug(false), 120)} // laisse le temps au clic
              onKeyDown={(e) => {
                if (!suggestions.length) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActiveIdx((i) => (i + 1) % suggestions.length);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActiveIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  selectSuggestion(suggestions[activeIdx]);
                } else if (e.key === "Escape") {
                  setShowSug(false);
                }
              }}
              className="pl-9"
            />

            {/* Liste de suggestions */}
            {showSug && suggestions.length > 0 && (
              <div className={"absolute z-30 mt-1 w-full " + FRAME + " bg-popover"}>
                <ul className="max-h-72 overflow-auto py-1">
                  {suggestions.map((fm, idx) => (
                    <li key={fm.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectSuggestion(fm)}
                        className={[
                          "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm",
                          idx === activeIdx ? "bg-muted" : "hover:bg-muted/70",
                        ].join(" ")}
                      >
                        <span className="truncate">
                          <span className="font-medium">{fm.nom}</span>
                          <span className="mx-2 text-muted-foreground">•</span>
                          <span className="text-muted-foreground">{fm.depNom}</span>
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] ${statusBadge(fm.etat)}`}>
                          {fm.siteNom}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>


            {/* Filtre Ville */}
            <Select onValueChange={setFilterCity} defaultValue="all" value={filterCity}>
              <SelectTrigger className={FRAME + " w-[160px]"}>
                <SelectValue placeholder="Ville" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">Toutes les villes</SelectItem>
                {cityOptions.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtre Département (dépend de la ville) */}
            <Select onValueChange={setFilterDept} defaultValue="all" value={filterDept}>
              <SelectTrigger className={FRAME + " w-[180px]"}>
                <SelectValue placeholder="Département" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">Tous les départements</SelectItem>
                {deptOptions.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtre État (existant) */}
            <Select onValueChange={setFilterEtat} defaultValue={filterEtat} value={filterEtat}>
              <SelectTrigger className={FRAME + " w-[170px]"}>
                <SelectValue placeholder="Filtrer par état" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="Actif">Actif</SelectItem>
                <SelectItem value="En maintenance">En maintenance</SelectItem>
                <SelectItem value="Hors service">Hors service</SelectItem>
              </SelectContent>
            </Select>

            {/* Toggle mode sombre */}
            <button
              aria-label="Basculer le mode sombre"
              onClick={toggle}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm ring-1 ring-border bg-background hover:bg-muted"
              title={dark ? "Mode clair" : "Mode sombre"}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* KPIs + Légende */}
      <section className="mx-auto w-full max-w-7xl px-6 py-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          {[{ label: "Sites", value: totals.sites, Icon: Building2 }, { label: "Départements", value: totals.departments, Icon: Activity }, { label: "Machines", value: totals.machines, Icon: Cog }].map(({ label, value, Icon }) => (
            <Card key={label} className={PANEL}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{value}</p>
              </CardContent>
            </Card>
          ))}

          <Card className={PANEL}>
            <CardHeader className="space-y-1 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">État des machines</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {Object.entries(STATUS_STYLES).map(([k]) => (
                <Badge key={k} className={`rounded-full ${statusBadge(k)}`}>{k}</Badge>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Sites → Départements → Machines */}
      <main className="mx-auto max-w-7xl px-6 pb-12">
        <Accordion
          type="single"
          collapsible
          className="space-y-3"
          value={openSite}
          onValueChange={(v) => setOpenSite(v || undefined)}
        >
          {filteredSites.map((site) => (
            <AccordionItem key={site.id} value={`site-${site.id}`} className={PANEL}>
              <AccordionTrigger className="px-4 py-3 text-left">
                <div className="flex w-full items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold leading-tight">{site.nom}</p>
                    <p className="truncate text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> {site.localisation}
                    </p>
                  </div>
                  <div className="hidden items-center gap-2 sm:flex">
                    <Badge variant="secondary" className="rounded-full">{site.departements.length} départements</Badge>
                  </div>
                </div>
              </AccordionTrigger>

              <AccordionContent className="px-4 pb-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                  <div className="md:col-span-2">
                    <SiteMapCard site={site} />
                  </div>

                  <div className="md:col-span-3 space-y-4">
                    <Accordion
                      type="multiple"
                      className="space-y-2"
                      value={openDepsBySite[site.id] ?? []}
                      onValueChange={(vals) =>
                        setOpenDepsBySite((prev) => ({ ...prev, [site.id]: vals as string[] }))
                      }
                    >
                      {site.departements.map((dep) => (
                        <AccordionItem key={dep.id} value={`dep-${dep.id}`} className={FRAME}>
                          <AccordionTrigger className="px-3 py-2 text-left">
                            <div className="flex w-full items-center justify-between gap-2">
                              <span className="text-sm font-semibold">{dep.nom}</span>
                              <Badge variant="outline" className="rounded-full">
                                {dep.machines.length} machines
                              </Badge>
                            </div>
                          </AccordionTrigger>

                          <AccordionContent className="px-3 pb-3">
                            {/* Desktop table */}
                            <div className="hidden md:block">
                              <div className={"overflow-hidden " + FRAME}>
                                <table className="w-full text-sm">
                                  <thead className="bg-muted text-muted-foreground">
                                    <tr>
                                      <th className="px-3 py-2 text-left font-medium">Machine</th>
                                      <th className="px-3 py-2 text-left font-medium">ID</th>
                                      <th className="px-3 py-2 text-left font-medium">État</th>
                                      <th className="px-3 py-2 text-left font-medium">Performance</th>
                                      <th className="px-3 py-2 text-left font-medium">Uptime</th>
                                      <th className="px-3 py-2 text-left font-medium">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border bg-background">
                                    {filterMachines(dep.machines).map((m) => {
                                      const rng = makeRng(m.id);
                                      const perf = m.performance ?? 70 + Math.round(rng() * 30);
                                      const up =
                                        m.etat === "Hors service"
                                          ? 0
                                          : m.etat === "En maintenance"
                                          ? 55 + Math.round(rng() * 10)
                                          : 90 + Math.round(rng() * 10);
                                      return (
                                        <tr
                                          key={m.id}
                                          ref={(el) => (machineRowRefs.current[m.id] = el)}
                                          className="align-middle"
                                        >
                                          <td className="px-3 py-2">{m.nom}</td>
                                          <td className="px-3 py-2 tabular-nums text-muted-foreground">{m.id}</td>
                                          <td className="px-3 py-2">
                                            <Badge className={`rounded-full ${statusBadge(m.etat)}`}>{m.etat}</Badge>
                                          </td>
                                          <td className="px-3 py-2 w-[220px]">
                                            <div className="flex items-center gap-2">
                                              <Progress value={perf} className="h-2" aria-label={`Performance ${perf}%`} />
                                              <span className="w-10 text-right tabular-nums text-xs text-muted-foreground">{perf}%</span>
                                            </div>
                                          </td>
                                          <td className="px-3 py-2 w-[140px] tabular-nums">{up}%</td>
                                          <td className="px-3 py-2">
                                            <MachineDialog m={m} onOpen={() => {}} />
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* Mobile cards */}
                            <div className="grid gap-3 md:hidden">
                              {filterMachines(dep.machines).map((m) => {
                                const rng = makeRng(m.id);
                                const perf = m.performance ?? 70 + Math.round(rng() * 30);
                                const up =
                                  m.etat === "Hors service"
                                    ? 0
                                    : m.etat === "En maintenance"
                                    ? 55 + Math.round(rng() * 10)
                                    : 90 + Math.round(rng() * 10);
                                return (
                                  <div key={m.id} className={FRAME + " p-3"}>
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="font-medium leading-tight">{m.nom}</p>
                                        <p className="text-xs text-muted-foreground">ID: {m.id}</p>
                                      </div>
                                      <Badge className={`rounded-full ${statusBadge(m.etat)}`}>{m.etat}</Badge>
                                    </div>
                                    <div className="mt-3 grid grid-cols-2 gap-3">
                                      <div>
                                        <p className="text-xs text-muted-foreground">Performance</p>
                                        <div className="mt-1 flex items-center gap-2">
                                          <Progress value={perf} className="h-2" />
                                          <span className="w-10 text-right tabular-nums text-xs text-muted-foreground">{perf}%</span>
                                        </div>
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground">Uptime</p>
                                        <p className="mt-1 tabular-nums">{up}%</p>
                                      </div>
                                    </div>
                                    <div className="mt-3">
                                      <MachineDialog m={m} onOpen={() => {}} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </main>

      {/* Animation légère */}
      {!prefersReducedMotion && (
        <motion.div aria-hidden initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Carte Google Maps simplifiée
function SiteMapCard({ site }: { site: Site }) {
  const { isLoaded } = useJsApiLoader({
    id: "neo-factory-maps",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
  });

  // Villes supportées (pas de géocodage côté client ici)
  const CITY_COORDS: Record<string, google.maps.LatLngLiteral> = {
    montreal: { lat: 45.5017, lng: -73.5673 },
    toronto: { lat: 43.6532, lng: -79.3832 },
    vancouver: { lat: 49.2827, lng: -123.1207 },
    calgary: { lat: 51.0447, lng: -114.0719 },
    quebec: { lat: 46.8139, lng: -71.2080 },
  };

  // Normalisation simple du libellé de ville → clé
  const cityKey = useMemo(() => {
    const a = site.localisation.toLowerCase();

    if (a.includes("montréal") || a.includes("montreal")) return "montreal";
    if (a.includes("toronto")) return "toronto";
    if (a.includes("vancouver")) return "vancouver";
    if (a.includes("calgary")) return "calgary";
    if (a.includes("québec") || a.includes("quebec")) return "quebec";

    // fallback
    return "toronto";
  }, [site.localisation]);

  const center = CITY_COORDS[cityKey];

  // Compteurs par état pour CE site
  const counts = useMemo(() => {
    const all = site.departements.flatMap((d) => d.machines);
    const acc: Record<string, number> = { Actif: 0, "En maintenance": 0, "Hors service": 0 };
    for (const m of all) acc[m.etat] = (acc[m.etat] ?? 0) + 1;
    return acc;
  }, [site]);

  // Joli libellé pour le titre
  const cityLabel =
    cityKey === "montreal" ? "Montréal" :
    cityKey === "toronto" ? "Toronto" :
    cityKey === "vancouver" ? "Vancouver" :
    cityKey === "calgary" ? "Calgary" :
    "Québec";

  return (
    <Card className={PANEL + " h-full"}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          Localisation — {cityLabel}
        </CardTitle>
      </CardHeader>

      <CardContent>
        {!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Ajoutez votre clé Google Maps dans <code>.env</code> →{" "}
            <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> pour afficher la carte.
          </p>
        )}

        {/* NOTE: espace ajouté avant {FRAME} + classes de hauteur correctes */}
        <div className={"mt-2 overflow-hidden " + FRAME + " h-[300px] md:h-[420px]"}>
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={{ width: "100%", height: "100%" }}
              center={center}
              zoom={11}
              options={{ disableDefaultUI: true, zoomControl: true, styles: MAP_CONTAINER_STYLE }}
            >
              <Marker position={center} label={cityLabel} />
            </GoogleMap>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Chargement de la carte…
            </div>
          )}
        </div>

        {/* Adresse brute */}
        <p className="mt-2 truncate text-xs text-muted-foreground">{site.localisation}</p>

        {/* Compteurs par état */}
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge className={`rounded-full ${statusBadge("Actif")}`}>
            Actif&nbsp;•&nbsp;{counts["Actif"] ?? 0}
          </Badge>
          <Badge className={`rounded-full ${statusBadge("En maintenance")}`}>
            En maintenance&nbsp;•&nbsp;{counts["En maintenance"] ?? 0}
          </Badge>
          <Badge className={`rounded-full ${statusBadge("Hors service")}`}>
            Hors service&nbsp;•&nbsp;{counts["Hors service"] ?? 0}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}


// ---------------------------------------------------------------------------
// Récupère site + département + machine par ID (pour "Configuration")
// Renvoie des champs prêts à afficher, avec "N/A" si manquant.
function getMachineConfig(machineId: number) {
  // Cherche le site / département / machine correspondants
  for (const site of factoryData) {
    for (const dep of site.departements) {
      const m = dep.machines.find((x) => x.id === machineId);
      if (m) {
        return {
          site: site.nom ?? "N/A",
          siteLocalisation: site.localisation ?? "N/A",
          departement: dep.nom ?? "N/A",
          id: m.id ?? "N/A",
          nom: m.nom ?? "N/A",
          etat: m.etat ?? "N/A",
          derniereMaintenance: m.derniereMaintenance ?? "N/A",
          // Champs techniques potentiels qui n'existent pas encore → N/A
          modele: m.modele ?? "N/A",
          firmware: m.firmware ?? "N/A",
          adresseIP: m.adresseIP ?? "N/A",
          serie: m.serie ?? "N/A",
        };
      }
    }
  }
  // Si l’ID n’existe pas (sécurité)
  return {
    site: "N/A",
    siteLocalisation: "N/A",
    departement: "N/A",
    id: machineId ?? "N/A",
    nom: "N/A",
    etat: "N/A",
    derniereMaintenance: "N/A",
    modele: "N/A",
    firmware: "N/A",
    adresseIP: "N/A",
    serie: "N/A",
  };
}

// Fenêtre de détails machine
// ---------------------------------------------------------------------------
// Fenêtre de détails machine (2 vues : Rapports / Configuration)
function MachineDialog({ m, onOpen }: { m: Machine; onOpen: () => void }) {
  // Graine stable par machine et par jour (valeurs pseudo-réalistes mais reproductibles)
  const daySalt = () => Math.floor(Date.now() / (24 * 3600 * 1000));
  const seedFrom = (...parts: (string | number)[]) =>
    [...parts.join("|")].reduce((a, c) => a + c.charCodeAt(0), 0);
  const seeded = (seed: number) => {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) % 2 ** 32;
      return (s >>> 0) / 2 ** 32;
    };
  };
  const gaussian = (rng: () => number, mean = 0, stdev = 1) => {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return mean + z * stdev;
  };
  const pct = (x: number) => Math.max(0, Math.min(100, Math.round(x)));

  const baseSeed = seedFrom(m.id, daySalt());
  const rng = seeded(baseSeed);

  // Indicateurs principaux
  const availability = m.etat === "Hors service" ? 0 : m.etat === "En maintenance" ? pct(gaussian(rng, 55, 6)) : pct(gaussian(rng, 88, 6));
  const quality = m.etat === "Hors service" ? 0 : m.etat === "En maintenance" ? pct(gaussian(rng, 57, 6)) : pct(gaussian(rng, 92, 6));
  const performance = m.performance

  const reliability = ["CPU", "Mémoire", "Stockage"].map((label, i) => {
    const r = seeded(seedFrom(m.id, label, daySalt()));
    return pct(gaussian(r, 86 - i * 2, 5));
  });

  // Séries simplifiées pour les graphiques
const piecesParHeure =
  m.etat === "Hors service" || m.etat === "En maintenance"
    ? Array.from({ length: 12 }, (_, i) => ({
        x: `${8 + i}h`,
        y: 0,
      }))
    : Array.from({ length: 12 }, (_, i) => {
        const r = seeded(seedFrom(m.id, "pph", i, daySalt()));
        const trend = 12 + 6 * Math.sin((i / 12) * Math.PI);
        const noise = gaussian(r, 0, 2.5);
        return { x: `${8 + i}h`, y: Math.max(0, Math.round(trend + noise)) };
      });


  const causesRaw = [
    { name: "Manque matériel", value: Math.round(8 + seeded(seedFrom(m.id, "mm", daySalt()))() * 32) },
    { name: "Maintenance",     value: Math.round(5 + seeded(seedFrom(m.id, "mnt", daySalt()))() * 23) },
    { name: "Setup",           value: Math.round(3 + seeded(seedFrom(m.id, "setup", daySalt()))() * 17) },
    { name: "Pause",           value: Math.round(2 + seeded(seedFrom(m.id, "break", daySalt()))() * 10) },
  ];
  const causesArret = causesRaw.sort((a, b) => b.value - a.value);

  // Vue active du popup
  const [view, setView] = useState<"rapports" | "configuration">("rapports");

  // Infos de configuration tirées du JSON (avec "N/A" si manquant)
  const cfg = getMachineConfig(m.id);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          onClick={() => {
            onOpen();
            setView("rapports");
          }}
          className="inline-flex items-center rounded-md px-3 py-1 text-sm font-medium transition-colors bg-background ring-1 ring-border hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Détails
        </button>
      </DialogTrigger>

      {/* Largeur accrue, scroll géré à l’intérieur (en-tête/pied collants) */}
      <DialogContent className="max-w-none sm:max-w-none w-[min(98vw,1400px)] p-0">
        <div className="max-h-[88vh] overflow-y-auto">
          {/* En-tête */}
          <div className="sticky top-0 z-10 border-b bg-background/95 px-6 py-4 backdrop-blur">
            <DialogHeader className="p-0">
              <DialogTitle className="flex items-center justify-between gap-2 text-base md:text-lg">
                <span className="flex items-center gap-2">
                  <Cog className="h-4 w-4 text-muted-foreground" />
                  {m.nom}
                </span>
                <Badge className={`rounded-full ${statusBadge(m.etat)}`}>{m.etat}</Badge>
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Contenu principal */}
          <div className="grid gap-4 p-6 md:grid-cols-2">
            {view === "rapports" ? (
              <>
                <Card className={PANEL}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Connexion</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Wifi className="h-4 w-4" />
                      Connecté • 2.4 Gbps
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${statusBadge(m.etat)}`}>{m.etat}</span>
                      <span className="text-xs text-muted-foreground">ID: {m.id}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className={PANEL}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Disponibilité</CardTitle>
                  </CardHeader>
                  <CardContent className="flex justify-center">
                    <Gauge label="24h" value={availability} />
                  </CardContent>
                </Card>

                <Card className={PANEL}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Performance</CardTitle>
                  </CardHeader>
                  <CardContent className="flex justify-center">
                    <Gauge label="Taux" value={performance} />
                  </CardContent>
                </Card>

                <Card className={PANEL}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Qualité</CardTitle>
                  </CardHeader>
                  <CardContent className="flex justify-center">
                    <Gauge label="OK" value={quality} />
                  </CardContent>
                </Card>

                <Card className={PANEL}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                      <TrendingUp className="h-4 w-4" /> Fiabilité
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-3 gap-2">
                    {["CPU", "Mémoire", "Stockage"].map((metric, i) => (
                      <div key={metric} className={FRAME + " p-3 text-center"}>
                        <div className="text-lg font-semibold text-primary tabular-nums">{reliability[i]}%</div>
                        <div className="text-xs text-muted-foreground">{metric}</div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className={PANEL + " md:col-span-2"}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Pièces complétées (aujourd’hui)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <MiniBar data={piecesParHeure} />
                  </CardContent>
                </Card>

                <Card className={PANEL + " md:col-span-2"}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Causes d’arrêt</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CategoryBar data={causesArret} />
                  </CardContent>
                </Card>

                <Card className={PANEL + " md:col-span-2"}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Database className="h-4 w-4" /> Maintenance
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>Dernière maintenance :</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                        {m.derniereMaintenance ?? "N/A"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <>
                <Card className={PANEL}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Informations générales</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      <InfoRow label="Site" value={cfg.site} />
                      <InfoRow label="Localisation" value={cfg.siteLocalisation} />
                      <InfoRow label="Département" value={cfg.departement} />
                      <InfoRow label="Machine" value={cfg.nom} />
                      <InfoRow label="ID" value={String(cfg.id)} />
                      <InfoRow label="État" value={cfg.etat} />
                      <InfoRow label="Dernière maintenance" value={cfg.derniereMaintenance} />
                    </div>
                  </CardContent>
                </Card>

                <Card className={PANEL}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Détails techniques</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      <InfoRow label="Modèle" value={cfg.modele} />
                      <InfoRow label="Firmware" value={cfg.firmware} />
                      <InfoRow label="Adresse IP" value={cfg.adresseIP} />
                      <InfoRow label="N° de série" value={cfg.serie} />
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Pied de popup */}
          <div className="sticky bottom-0 z-10 border-t bg-background/95 px-6 py-3 backdrop-blur">
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setView("configuration")}
                className={`inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm ring-1 transition-colors
                  ${view === "configuration"
                    ? "bg-primary text-primary-foreground ring-primary"
                    : "bg-background text-foreground ring-border hover:bg-muted"}`}
              >
                <Settings className="mr-2 h-4 w-4" />
                Configuration
              </button>

              <button
                type="button"
                onClick={() => setView("rapports")}
                className={`inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm ring-1 transition-colors
                  ${view === "rapports"
                    ? "bg-primary text-primary-foreground ring-primary"
                    : "bg-background text-foreground ring-border hover:bg-muted"}`}
              >
                <TrendingUp className="mr-2 h-4 w-4" />
                Rapports
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}



// Ligne d'info compacte (label à gauche, valeur à droite)
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 ring-1 ring-border">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value || "N/A"}</span>
    </div>
  );
}
