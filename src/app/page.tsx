"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [selected, setSelected] = useState<Machine | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const { dark, toggle } = useDarkMode();

  // Compteurs globaux (sites, départements, machines)
  const totals = useMemo(() => {
    const sites = factoryData.length;
    const departments = factoryData.reduce((a, b) => a + b.departements.length, 0);
    const machines = factoryData.reduce(
      (a, b) => a + b.departements.reduce((c, d) => c + d.machines.length, 0),
      0,
    );
    return { sites, departments, machines };
  }, []);

  // Filtrage par recherche + état
  const filterMachines = (machines: Machine[]): Machine[] =>
    machines.filter((m) => {
      const matchesSearch = m.nom.toLowerCase().includes(search.toLowerCase());
      const matchesEtat = filterEtat === "all" || m.etat === filterEtat;
      return matchesSearch && matchesEtat;
    });

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Barre du haut */}
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Factory className="h-6 w-6 text-primary" aria-hidden="true" />
            <div>
              <h1 className="text-lg font-semibold leading-tight tracking-tight md:text-xl">NeoFactory</h1>
              <p className="text-xs text-muted-foreground">Operational Dashboard</p>
            </div>
          </div>

          {/* Recherche + filtres + bouton thème */}
          <div className="flex flex-1 items-center justify-end gap-3">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Rechercher une machine"
                placeholder="Rechercher une machine…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select onValueChange={(v) => setFilterEtat(v)} defaultValue="all">
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
              <span className="hidden sm:inline">{dark ? "Light" : "Dark"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Cartes de stats + légende */}
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

          {/* Légende états */}
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

      {/* Sites + départements + machines */}
      <main className="mx-auto max-w-7xl px-6 pb-12">
        <Accordion type="single" collapsible className="space-y-3">
          {factoryData.map((site) => (
            <AccordionItem key={site.id} value={`site-${site.id}`} className={PANEL}>
              <AccordionTrigger className="px-4 py-3 text-left">
                <div className="flex w-full items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold leading-tight">{site.nom}</p>
                    <p className="truncate text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {site.localisation}</p>
                  </div>
                  <div className="hidden items-center gap-2 sm:flex">
                    <Badge variant="secondary" className="rounded-full">{site.departements.length} départements</Badge>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                {/* Vue site : carte + départements */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                  <div className="md:col-span-2">
                    <SiteMapCard address={site.localisation} />
                  </div>
                  <div className="md:col-span-3 space-y-4">
                    {site.departements.map((dep) => (
                      <Card key={dep.id} className={PANEL}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                          <CardTitle className="text-sm font-semibold">{dep.nom}</CardTitle>
                          <Badge variant="outline" className="rounded-full"> {dep.machines.length} machines</Badge>
                        </CardHeader>
                        <CardContent className="pt-0">
                          {/* Table responsive */}
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
                                    const perf = 70 + Math.round(rng() * 30); // 70–100
                                    const uptime = 90 + Math.round(rng() * 10); // 90–100
                                    return (
                                      <tr key={m.id} className="align-middle">
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
                                        <td className="px-3 py-2 w-[140px] tabular-nums">{uptime}%</td>
                                        <td className="px-3 py-2">
                                          <MachineDialog m={m} onOpen={() => setSelected(m)} />
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Version mobile en cartes */}
                          <div className="grid gap-3 md:hidden">
                            {filterMachines(dep.machines).map((m) => {
                              const rng = makeRng(m.id);
                              const perf = 70 + Math.round(rng() * 30);
                              const uptime = 90 + Math.round(rng() * 10);
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
                                      <p className="mt-1 tabular-nums">{uptime}%</p>
                                    </div>
                                  </div>
                                  <div className="mt-3">
                                    <MachineDialog m={m} onOpen={() => setSelected(m)} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </main>

      {/* Animation légère à l’apparition */}
      {!prefersReducedMotion && (
        <motion.div aria-hidden initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Carte Google Maps simplifiée
function SiteMapCard({ address }: { address: string }) {
  const { isLoaded } = useJsApiLoader({ id: "neo-factory-maps", googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "" });

  const CITY_COORDS: Record<string, google.maps.LatLngLiteral> = {
    montreal: { lat: 45.5017, lng: -73.5673 },
    toronto: { lat: 43.6532, lng: -79.3832 },
  };

  const cityKey = useMemo(() => {
    const a = address.toLowerCase();
    if (a.includes("montréal") || a.includes("montreal")) return "montreal";
    if (a.includes("toronto")) return "toronto";
    return "toronto";
  }, [address]);

  const center = CITY_COORDS[cityKey];

  return (
    <Card className={PANEL + " h-full"}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" /> Localisation — {cityKey === "montreal" ? "Montréal" : "Toronto"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
          <p className="text-xs text-amber-600 dark:text-amber-400">Ajoutez votre clé Google Maps dans <code>.env</code> → <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> pour afficher la carte.</p>
        )}
        <div className={"mt-2 overflow-hidden " + FRAME}>
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={{ width: "100%", height: 260 }}
              center={center}
              zoom={11}
              options={{ disableDefaultUI: true, zoomControl: true, styles: MAP_CONTAINER_STYLE }}
            >
              <Marker position={center} label={cityKey === "montreal" ? "Montréal" : "Toronto"} />
            </GoogleMap>
          ) : (
            <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">Chargement de la carte…</div>
          )}
        </div>
        <p className="mt-2 truncate text-xs text-muted-foreground">{address}</p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Fenêtre de détails machine
function MachineDialog({ m, onOpen }: { m: Machine; onOpen: () => void }) {
  const rng = makeRng(m.id);
  const availability = 75 + Math.round(rng() * 25); // 75–100
  const reliability = ["CPU", "Mémoire", "Stockage"].map(() => 70 + Math.round(rng() * 30));

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          onClick={onOpen}
          className="inline-flex items-center rounded-md px-3 py-1 text-sm font-medium transition-colors bg-background ring-1 ring-border hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Détails
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base md:text-lg">
            <Cog className="h-4 w-4 text-muted-foreground" />
            {m.nom}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          {/* Connexion */}
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

          {/* Disponibilité */}
          <Card className={PANEL}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Disponibilité (24h)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Progress value={availability} className="h-2" />
                <span className="w-10 text-right tabular-nums text-xs text-muted-foreground">{availability}%</span>
              </div>
            </CardContent>
          </Card>

          {/* Performance + fiabilité */}
          <Card className={PANEL + " md:col-span-2"}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" /> Production & Fiabilité
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Performance</span>
                  <span className="tabular-nums">94%</span>
                </div>
                <Progress value={94} className="h-2" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {["CPU", "Mémoire", "Stockage"].map((metric, i) => (
                  <div key={metric} className={FRAME + " p-3 text-center"}>
                    <div className="text-lg font-semibold text-primary tabular-nums">{reliability[i]}%</div>
                    <div className="text-xs text-muted-foreground">{metric}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Section maintenance */}
          <Card className={PANEL + " md:col-span-2"}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                <Database className="h-4 w-4" /> Maintenance
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span>Dernière maintenance :</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{m.derniereMaintenance ?? "Jamais"}</span>
              </div>
              <div className="mt-3 flex gap-2">
                <button className="inline-flex items-center rounded-md bg-background px-3 py-1 text-sm transition-colors ring-1 ring-border hover:bg-muted">
                  <Settings className="mr-2 h-4 w-4" />
                  Configuration
                </button>
                <button className="inline-flex items-center rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground hover:bg-primary/90">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Rapports
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
