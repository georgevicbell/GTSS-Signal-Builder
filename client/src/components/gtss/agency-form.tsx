import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import MapTileLayers from "@/components/ui/map-tile-layers";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { convertAgencyUnits, useAgencies, useGTSSStore, useMapScrollZoom } from "gtss";
import { Agency, type InsertAgency, insertAgencySchema } from "gtss/schema";
import { Crosshair, Edit3, MapPin, Trash } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { MapContainer, Marker, useMap, useMapEvents } from "react-leaflet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "../ui/resizable";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";

// Map picker component for location selection
function LocationPicker({
  onLocationSelect,
}: {
  onLocationSelect: (lat: number, lon: number) => void;
}) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Observes container size changes and invalidates the Leaflet map so it
// redraws correctly when surrounding panes resize (prevents gray tiles).
function MapResizeObserverLocal() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    if (!container || typeof window.ResizeObserver === "undefined") return;

    let timeoutId: number | null = null;
    const ro = new ResizeObserver(() => {
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        try {
          if (map && map.getContainer()) {
            map.invalidateSize();
          }
        } catch (err) {
          console.warn("AgencyForm: failed to invalidate map size", err);
        }
      }, 50);
    });

    ro.observe(container);
    if (container.parentElement) ro.observe(container.parentElement);

    return () => {
      ro.disconnect();
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [map]);

  return null;
}

export default function AgencyForm() {
  const mapScrollZoom = useMapScrollZoom();
  const { agency, setAgency, signals, approaches, phases, detectors, basicTimings } =
    useGTSSStore();
  const agenciesApi = useAgencies();

  // Local modal state (Add/Edit) — modal state is intentionally local to this component
  const [agencyModalOpen, setAgencyModalOpen] = useState(false);
  const [agencyModalEditingId, setAgencyModalEditingId] = useState<string | null>(null);
  const { toast } = useToast();
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lon: number;
    city?: string;
    state?: string;
    displayName?: string;
  } | null>(null);
  const [isGeocodingUserLocation, setIsGeocodingUserLocation] = useState(false);
  const [unitChangeDialogOpen, setUnitChangeDialogOpen] = useState(false);
  const [pendingMetricValue, setPendingMetricValue] = useState<boolean | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>(() => {
    // Initialize map center with saved agency coordinates if available
    if (agency?.latitude != null && agency?.longitude != null) {
      return [agency.latitude, agency.longitude];
    }
    return [39.8283, -98.5795]; // Default center of US
  });

  const saveAgency = (data: InsertAgency) => {
    try {
      agenciesApi.save(data);
      toast({
        title: "Success",
        description: "Agency information saved successfully",
      });
      // Close modal when saving from modal
      setAgencyModalOpen(false);
      setAgencyModalEditingId(null);
    } catch {
      toast({
        title: "Error",
        description: "Failed to save agency information",
        variant: "destructive",
      });
    }
  };

  const normalizeAgencyUrl = (url: string) => {
    if (!url) {
      return "http://";
    }
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    return `http://${url}`;
  };

  const form = useForm<InsertAgency>({
    resolver: zodResolver(insertAgencySchema),
    defaultValues: {
      agencyId: "",
      agencyName: "",
      agencyUrl: "http://",
      agencyTimezone: "America/Los_Angeles",
      agencyEmail: "",
      agencyIsMetric: false,
      latitude: undefined,
      longitude: undefined,
    },
  });

  useEffect(() => {
    // When opening the modal: if editingId is set, preload that agency; if not, reset to empty defaults for adding
    if (agencyModalOpen) {
      if (agencyModalEditingId) {
        const editAgency = agenciesApi.get(agencyModalEditingId);
        if (editAgency) {
          form.reset({
            agencyId: editAgency.agencyId,
            agencyName: editAgency.agencyName,
            agencyUrl: normalizeAgencyUrl(editAgency.agencyUrl || ""),
            agencyTimezone: editAgency.agencyTimezone,
            agencyEmail: editAgency.agencyEmail || "",
            agencyIsMetric: editAgency.agencyIsMetric ?? false,
            latitude: editAgency.latitude ?? undefined,
            longitude: editAgency.longitude ?? undefined,
          });
          setSelectedLocation(
            editAgency.latitude != null && editAgency.longitude != null
              ? {
                  lat: editAgency.latitude,
                  lon: editAgency.longitude,
                  displayName: editAgency.agencyName,
                }
              : null,
          );
          setMapCenter([editAgency.latitude ?? 39.8283, editAgency.longitude ?? -98.5795]);
        }
      } else {
        // New agency: clear form to defaults
        form.reset({
          agencyId: "",
          agencyName: "",
          agencyUrl: "http://",
          agencyTimezone: "America/Los_Angeles",
          agencyEmail: "",
          agencyIsMetric: false,
          latitude: undefined,
          longitude: undefined,
        });
        setSelectedLocation(null);
        setMapCenter([39.8283, -98.5795]);
      }
    }
  }, [agencyModalOpen, agencyModalEditingId]);

  // Listen for global requests to open the agency modal (from header or other UI)
  useEffect(() => {
    function handleOpenEvent(e: Event) {
      const ce = e as CustomEvent<{ editingId: string | null }>;
      setAgencyModalEditingId(ce?.detail?.editingId ?? null);
      setAgencyModalOpen(true);
    }
    window.addEventListener("open-agency-modal", handleOpenEvent as EventListener);
    return () => window.removeEventListener("open-agency-modal", handleOpenEvent as EventListener);
  }, []);

  const onSubmit = (data: InsertAgency) => {
    // Include selected location coordinates in save data
    const saveData = {
      ...data,
      agencyUrl: normalizeAgencyUrl(data.agencyUrl || ""),
      agencyIsMetric: data.agencyIsMetric ?? false,
      latitude: selectedLocation?.lat ?? data.latitude,
      longitude: selectedLocation?.lon ?? data.longitude,
    };
    saveAgency(saveData);
  };
  const agencies = agenciesApi.data;
  const defaultAgencyId = agenciesApi.defaultId;

  const handleLoadAgency = (a: Agency) => {
    // load into form and store
    form.reset({
      agencyId: a.agencyId,
      agencyName: a.agencyName,
      agencyUrl: a.agencyUrl || "http://",
      agencyTimezone: a.agencyTimezone,
      agencyEmail: a.agencyEmail || "",
      agencyIsMetric: a.agencyIsMetric ?? false,
      latitude: a.latitude ?? undefined,
      longitude: a.longitude ?? undefined,
    });
    setSelectedLocation(
      a.latitude != null && a.longitude != null
        ? { lat: a.latitude, lon: a.longitude, displayName: a.agencyName }
        : null,
    );
    setMapCenter([a.latitude ?? 39.8283, a.longitude ?? -98.5795]);
    setAgency(a);
  };

  const handleSetDefault = (id: string) => {
    agenciesApi.setDefault(id);
    toast({ title: "Default Set", description: "Default agency updated" });
  };
  // Note: deletion is only allowed via cascade to avoid orphaned records.

  const handleDeleteCascade = (id: string) => {
    const targetAgency = agenciesApi.get(id);
    if (!targetAgency) {
      toast({
        title: "Not Found",
        description: "Agency could not be found.",
        variant: "destructive",
      });
      return;
    }

    agenciesApi.deleteWithCascade(id);
    toast({ title: "Deleted", description: "Agency and related data removed" });
  };

  /*
  const generateAgencyId = (state: string, agencyName: string): string => {
    // Get state abbreviation
    const stateAbbreviations: Record<string, string> = {
      California: "CA",
      Texas: "TX",
      Florida: "FL",
      "New York": "NY",
      Pennsylvania: "PA",
      Illinois: "IL",
      Ohio: "OH",
      Georgia: "GA",
      "North Carolina": "NC",
      Michigan: "MI",
      Virginia: "VA",
      Washington: "WA",
      Arizona: "AZ",
      Massachusetts: "MA",
      Tennessee: "TN",
      Indiana: "IN",
      Missouri: "MO",
      Maryland: "MD",
      Wisconsin: "WI",
      Minnesota: "MN",
      Colorado: "CO",
      Alabama: "AL",
      Louisiana: "LA",
      Kentucky: "KY",
      Oregon: "OR",
      Oklahoma: "OK",
      Connecticut: "CT",
      Utah: "UT",
      Iowa: "IA",
      Nevada: "NV",
      Arkansas: "AR",
      Mississippi: "MS",
      Kansas: "KS",
      "New Mexico": "NM",
      Nebraska: "NE",
      "West Virginia": "WV",
      Idaho: "ID",
      Hawaii: "HI",
      "New Hampshire": "NH",
      Maine: "ME",
      "Rhode Island": "RI",
      Montana: "MT",
      Delaware: "DE",
      "South Dakota": "SD",
      "North Dakota": "ND",
      Alaska: "AK",
      Vermont: "VT",
      Wyoming: "WY",
    };

    const stateCode = stateAbbreviations[state] || state.toUpperCase().substring(0, 2);

    // Extract city name from agency name
    const words = agencyName
      .replace(/department|transportation|traffic|signals?|management|dot|city|county/gi, "")
      .trim()
      .split(/\s+/);
    const cityCode = words[0] ? words[0].substring(0, 3).toUpperCase() : "AGN";

    return `${stateCode}_${cityCode}_001`;
  };
*/
  const handleLocationClick = (lat: number, lon: number, isUserLocation = false) => {
    // Save coordinates without geocoding
    setSelectedLocation({
      lat,
      lon,
      displayName: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
    });

    // Always save coordinates to form
    form.setValue("latitude", lat);
    form.setValue("longitude", lon);

    // Update store with coordinates for map centering
    if (agency) {
      setAgency({
        ...agency,
        latitude: lat,
        longitude: lon,
      });
    }

    if (isUserLocation) {
      toast({
        title: "Location Updated",
        description: `Coordinates set to ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
      });
    }
  };

  const handleGetUserLocation = () => {
    setIsGeocodingUserLocation(true);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          setMapCenter([lat, lon]);
          handleLocationClick(lat, lon, true);
          setIsGeocodingUserLocation(false);
        },
        (error) => {
          console.error("Geolocation failed:", error);
          toast({
            title: "Location Error",
            description: "Unable to get your location. Please click on the map to set coordinates.",
            variant: "destructive",
          });
          setIsGeocodingUserLocation(false);
        },
      );
    } else {
      toast({
        title: "Not Supported",
        description:
          "Geolocation is not supported by your browser. Please click on the map to set coordinates.",
        variant: "destructive",
      });
      setIsGeocodingUserLocation(false);
    }
  };

  return (
    <div className="max-w-6xl h-full flex flex-col">
      <ResizablePanelGroup
        direction="vertical"
        autoSaveId="agency-map-split"
        className="flex-1 min-h-[320px] rounded-lg border border-grey-200 bg-white overflow-hidden"
      >
        <ResizablePanel defaultSize={40} minSize={12} className="relative z-0">
          <div className="w-full h-full relative z-0">
            <MapContainer
              key={agency?.id ?? "default"}
              center={
                agency?.latitude != null && agency?.longitude != null
                  ? [agency.latitude, agency.longitude]
                  : [39.8283, -98.5795]
              }
              zoom={agency?.latitude != null && agency?.longitude != null ? 12 : 4}
              scrollWheelZoom={false}
              style={{ height: "100%", width: "100%" }}
              className="rounded-lg border"
            >
              <MapTileLayers />

              <MapResizeObserverLocal />
              {agency && agency.latitude != null && agency.longitude != null && (
                <Marker position={[agency.latitude, agency.longitude]} />
              )}
            </MapContainer>
          </div>
        </ResizablePanel>
        <ResizableHandle
          withHandle
          className="bg-grey-200 hover:bg-primary-300 transition-colors"
        />
        <ResizablePanel defaultSize={60} minSize={20} className="flex flex-col min-h-0">
          <Card className="rounded-none border-0 flex flex-col h-full min-h-0">
            <CardContent className="p-0 flex-1 min-h-0 overflow-auto">
              <div className="w-full">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-grey-50">
                      <TableRow>
                        <TableHead className="text-sm">Agency Name</TableHead>
                        <TableHead className="text-sm">Agency ID</TableHead>
                        <TableHead className="text-sm">Signals</TableHead>
                        <TableHead className="text-sm">Default</TableHead>
                        <TableHead className="text-sm text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agencies.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6 text-xs text-grey-500">
                            No agencies yet. Save one to add it to the list.
                          </TableCell>
                        </TableRow>
                      ) : (
                        agencies.map((a) => (
                          <TableRow
                            key={a.id}
                            className="hover:bg-grey-50 cursor-pointer transition-colors"
                            onClick={() => handleLoadAgency(a)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleLoadAgency(a);
                              }
                            }}
                            tabIndex={0}
                            role="button"
                            data-testid={`row-agency-${a.agencyId}`}
                          >
                            <TableCell className="font-medium text-grey-900 text-sm py-2 px-3">
                              {a.agencyName}
                            </TableCell>
                            <TableCell className="text-grey-600 text-xs py-2 px-3">
                              {a.agencyId}
                            </TableCell>
                            <TableCell className="text-grey-600 text-xs py-2 px-3">
                              {signals.filter((s) => s.agencyId === a.agencyId).length}
                            </TableCell>
                            <TableCell className="text-xs py-2 px-3">
                              {defaultAgencyId === a.id ? (
                                <Badge>Default</Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSetDefault(a.id);
                                  }}
                                >
                                  Set Default
                                </Button>
                              )}
                            </TableCell>
                            <TableCell className="text-xs py-2 px-3">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.dispatchEvent(
                                      new CustomEvent("open-agency-modal", {
                                        detail: { editingId: a.id },
                                      }),
                                    );
                                  }}
                                  aria-label={`Edit ${a.agencyName}`}
                                >
                                  <Edit3 className="w-4 h-4" />
                                  <span className="sr-only">Edit</span>
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      aria-label={`Delete ${a.agencyName}`}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Trash className="w-4 h-4" aria-hidden="true" />
                                      <span className="sr-only">Delete</span>
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Agency</AlertDialogTitle>
                                      {(() => {
                                        const depSignals = signals.filter(
                                          (s) => s.agencyId === a.agencyId,
                                        );
                                        const depSignalIds = depSignals.map((s) => s.signalId);
                                        const depApproaches = approaches.filter((ap) =>
                                          depSignalIds.includes(ap.signalId),
                                        ).length;
                                        const depPhases = phases.filter((p) =>
                                          depSignalIds.includes(p.signalId),
                                        ).length;
                                        const depDetectors = detectors.filter((d) =>
                                          depSignalIds.includes(d.signalId),
                                        ).length;
                                        const depTimings = basicTimings.filter((t) =>
                                          depSignalIds.includes(t.signalId),
                                        ).length;
                                        const totalDependents =
                                          depSignals.length +
                                          depApproaches +
                                          depPhases +
                                          depDetectors +
                                          depTimings;

                                        if (totalDependents > 0) {
                                          return (
                                            <AlertDialogDescription>
                                              Deleting this agency will also remove{" "}
                                              {depSignals.length} signal(s), {depApproaches}{" "}
                                              approach(es), {depPhases} phase(s), {depDetectors}{" "}
                                              detector(s), and {depTimings} timing record(s). This
                                              can't be undone. Are you sure you want to proceed?
                                            </AlertDialogDescription>
                                          );
                                        }
                                        return (
                                          <AlertDialogDescription>
                                            This can't be undone. Are you sure you want to delete
                                            this agency?
                                          </AlertDialogDescription>
                                        );
                                      })()}
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <div className="flex gap-2">
                                        <AlertDialogAction
                                          onClick={() => handleDeleteCascade(a.id)}
                                        >
                                          Delete Agency and Data
                                        </AlertDialogAction>
                                      </div>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Modal containing the agency form (Add / Edit) */}
      <Dialog
        open={agencyModalOpen}
        onOpenChange={(open) => {
          setAgencyModalOpen(open);
          if (!open) setAgencyModalEditingId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{agencyModalEditingId ? "Edit Agency" : "Add Agency"}</DialogTitle>
          </DialogHeader>
          <Card>
            <CardContent className="p-4">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  {/* Integrated Location Picker */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-medium">Agency Location</h3>
                        <p className="text-xs text-grey-600">
                          Select your agency's location. This will be used as the center point for
                          signal maps.
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={handleGetUserLocation}
                        disabled={isGeocodingUserLocation}
                        variant="outline"
                        className="h-7 px-2 text-xs"
                      >
                        <Crosshair className="w-3 h-3 mr-1" />
                        {isGeocodingUserLocation ? "Locating..." : "Use My Location"}
                      </Button>
                    </div>

                    <div className="h-48 sm:h-64 relative z-0">
                      <MapContainer
                        center={mapCenter}
                        zoom={selectedLocation ? 12 : 6}
                        scrollWheelZoom={mapScrollZoom}
                        style={{ height: "100%", width: "100%" }}
                        className="rounded-lg border"
                        key={`agency-map-${mapCenter[0]}-${mapCenter[1]}`}
                      >
                        <MapTileLayers />

                        <MapResizeObserverLocal />
                        <LocationPicker onLocationSelect={handleLocationClick} />

                        {selectedLocation && (
                          <Marker position={[selectedLocation.lat, selectedLocation.lon]} />
                        )}
                      </MapContainer>
                    </div>

                    {selectedLocation && (
                      <Card className="bg-green-50 border-green-200">
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-green-800 text-sm">
                                Selected Location
                              </div>
                              <div className="text-xs text-green-700">
                                {selectedLocation.city && selectedLocation.state
                                  ? `${selectedLocation.city}, ${selectedLocation.state}`
                                  : selectedLocation.displayName}
                              </div>
                              <div className="text-xs text-green-600">
                                {selectedLocation.lat.toFixed(6)}, {selectedLocation.lon.toFixed(6)}
                              </div>
                            </div>
                            <Badge
                              variant="secondary"
                              className="bg-green-100 text-green-800 text-xs"
                            >
                              <MapPin className="w-3 h-3 mr-1" />
                              Auto-populated
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  {/* Agency Information Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="agencyId"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-xs font-medium">
                            Agency ID <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., TM_001"
                              className={`h-7 px-2 text-xs ${agencyModalEditingId ? "bg-grey-100" : ""}`}
                              {...field}
                              disabled={!!agencyModalEditingId}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="agencyName"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-xs font-medium">
                            Agency Name <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., Los Angeles Department of Transportation"
                              className="h-7 px-2 text-xs"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="agencyUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Agency URL</FormLabel>
                          <FormControl>
                            <Input
                              type="url"
                              placeholder="https://agency-website.com"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="agencyTimezone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Timezone <span className="text-red-500">*</span>
                          </FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select timezone" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="America/New_York">America/New_York</SelectItem>
                              <SelectItem value="America/Chicago">America/Chicago</SelectItem>
                              <SelectItem value="America/Denver">America/Denver</SelectItem>
                              <SelectItem value="America/Los_Angeles">
                                America/Los_Angeles
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="agencyEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Agency Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="agency@domain.com"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="agencyIsMetric"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-3">
                          <FormControl>
                            <Checkbox
                              checked={!!field.value}
                              onCheckedChange={(v) => {
                                const newVal = Boolean(v);
                                // If editing an existing agency with data, warn before switching
                                const editingAgency = agencyModalEditingId
                                  ? agenciesApi.get(agencyModalEditingId)
                                  : null;
                                if (editingAgency) {
                                  // Find any dependent records for this agency
                                  const sigIds = signals
                                    .filter((s) => s.agencyId === editingAgency.agencyId)
                                    .map((s) => s.signalId);
                                  const apCount = approaches.filter((a) =>
                                    sigIds.includes(a.signalId),
                                  ).length;
                                  const phCount = phases.filter((p) =>
                                    sigIds.includes(p.signalId),
                                  ).length;
                                  const detCount = detectors.filter((d) =>
                                    sigIds.includes(d.signalId),
                                  ).length;

                                  if (apCount + phCount + detCount > 0) {
                                    // show confirmation dialog before converting
                                    setPendingMetricValue(newVal);
                                    setUnitChangeDialogOpen(true);
                                    return;
                                  }
                                }

                                // No existing data or new agency — just update the field
                                field.onChange(newVal);
                              }}
                            />
                          </FormControl>
                          <div>
                            <FormLabel className="m-0">Use metric units</FormLabel>
                            <div className="text-xs text-grey-500">
                              Speeds in km/h, distances in meters
                            </div>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Confirmation dialog for unit conversion */}
                    <Dialog open={unitChangeDialogOpen} onOpenChange={setUnitChangeDialogOpen}>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Convert existing values?</DialogTitle>
                        </DialogHeader>
                        <div className="py-2">
                          <p className="text-sm text-grey-700">
                            Changing units will convert existing posted speeds, detector distances,
                            and measured crosswalk lengths for this agency. This operation updates
                            stored numeric values so labels remain correct. Do you want to proceed?
                          </p>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setUnitChangeDialogOpen(false);
                              setPendingMetricValue(null);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={async () => {
                              setUnitChangeDialogOpen(false);
                              try {
                                const targetIsMetric = !!pendingMetricValue;
                                const editingAgency = agencyModalEditingId
                                  ? agenciesApi.get(agencyModalEditingId)
                                  : null;
                                if (!editingAgency) return;

                                const updatedAgency = convertAgencyUnits(
                                  editingAgency,
                                  targetIsMetric,
                                );

                                form.setValue("agencyIsMetric", targetIsMetric);
                                setAgency(updatedAgency);

                                toast({
                                  title: "Converted",
                                  description: "Values converted to selected units",
                                });
                              } catch (err) {
                                console.error(err);
                                toast({
                                  title: "Error",
                                  description: "Failed to convert units",
                                  variant: "destructive",
                                });
                              } finally {
                                setPendingMetricValue(null);
                              }
                            }}
                          >
                            Convert Values
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      className="h-8 px-4 text-xs bg-primary-600 hover:bg-primary-700"
                      disabled={false}
                    >
                      Save Agency Information
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    </div>
  );
}
