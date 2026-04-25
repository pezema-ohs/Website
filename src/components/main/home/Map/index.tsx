"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import PharmacyMap from "./PharmacyMap";
import { Location, Pharmacy } from "./types";
import { useGeocode } from "./useGeocode";
import { usePharmacySearch } from "./usePharmacySearch";
import { useGoogleMaps } from "./GoogleMapsProvider";

interface MapComponentProps {
  pickupAddress?: string;
  dropoffAddress?: string;
  pickupLocation?: Location | null;
  dropoffLocation?: Location | null;
  zipCode?: string;
  city?: string;
  state?: string;
  pharmacies?: Pharmacy[]; // externally provided pharmacy list
  onPharmacyClick?: (pharmacy: Pharmacy) => void;
  onPharmacySelect?: (pharmacy: Pharmacy) => void;
  showRoute?: boolean;
  height?: string;
  onPickupSelect?: (location: Location, address: string, name?: string) => void;
  onDropoffSelect?: (location: Location, address: string, name?: string) => void;
  selectionMode?: "pickup" | "dropoff" | null;
  onDistanceCalculated?: (distance: string, duration: string) => void;
  /** When this key changes, local pickup/dropoff markers are cleared (e.g. after closing out-of-coverage modal). */
  markersResetKey?: number;
  /** Called when user's location is detected (for Redux/currentLocation). */
  onUserLocationDetected?: (address: string) => void;
}

export default function MapComponent({
  pickupAddress,
  dropoffAddress,
  pickupLocation: pickupLocationProp,
  dropoffLocation: dropoffLocationProp,
  zipCode,
  city,
  state,
  pharmacies: pharmaciesProp,
  onPharmacyClick,
  onPharmacySelect,
  showRoute = false,
  height = "100%",
  onPickupSelect,
  onDropoffSelect,
  selectionMode = null,
  onDistanceCalculated,
  markersResetKey,
  onUserLocationDetected,
}: MapComponentProps) {
  const [pickupLocation, setPickupLocation] = useState<Location | null>(
    pickupLocationProp || null
  );
  const [dropoffLocation, setDropoffLocation] = useState<Location | null>(
    dropoffLocationProp || null
  );
  const [mapCenter, setMapCenter] = useState<Location | null>(null);
  const [locationDeniedOrError, setLocationDeniedOrError] = useState(false);
  const [userLocationForGeocode, setUserLocationForGeocode] = useState<Location | null>(null);
  const hasCalledOnUserLocationDetectedRef = useRef(false);
  const { geocodeAddress, geocodeByZipCode, geocodeByCityState, reverseGeocode } = useGeocode();
  const {
    pharmacies,
    searchPharmaciesByLocation,
    loading: pharmacyLoading,
  } = usePharmacySearch();
  const pharmacySearchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSearchedLocationRef = useRef<string | null>(null);
  const { isLoaded: mapsLoaded, loadError: mapsError } = useGoogleMaps();

  const newYorkCenter: Location = { lat: 40.7128, lng: -74.006 };

  // Initial load: get user location; fallback to New York and show "enable location" if denied
  useEffect(() => {
    if (zipCode || city || state || pickupAddress || dropoffAddress) return;

    if (!navigator.geolocation) {
      setLocationDeniedOrError(true);
      setMapCenter(newYorkCenter);
      searchPharmaciesByLocation(newYorkCenter);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLoc: Location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setMapCenter(userLoc);
        searchPharmaciesByLocation(userLoc);
        setUserLocationForGeocode(userLoc);
        setLocationDeniedOrError(false);
      },
      () => {
        setLocationDeniedOrError(true);
        setMapCenter(newYorkCenter);
        searchPharmaciesByLocation(newYorkCenter);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After maps load and we have user location: reverse-geocode and notify parent (Redux)
  useEffect(() => {
    if (!mapsLoaded || hasCalledOnUserLocationDetectedRef.current || !onUserLocationDetected) return;
    const userLoc = userLocationForGeocode;
    if (!userLoc) return;

    let cancelled = false;
    reverseGeocode(userLoc).then((address) => {
      if (cancelled || !address) return;
      hasCalledOnUserLocationDetectedRef.current = true;
      onUserLocationDetected(address);
    });
    return () => {
      cancelled = true;
    };
  }, [mapsLoaded, userLocationForGeocode, reverseGeocode, onUserLocationDetected]);

  // Debounced pharmacy search helper
  const debouncedPharmacySearch = useCallback(
    (location: Location | null) => {
      if (pharmacySearchTimerRef.current) {
        clearTimeout(pharmacySearchTimerRef.current);
      }

      if (!location) {
        return;
      }

      // Create a location key to avoid duplicate searches
      const locationKey = `${location.lat.toFixed(4)},${location.lng.toFixed(
        4
      )}`;
      if (lastSearchedLocationRef.current === locationKey) {
        return; // Skip if we already searched this location
      }

      pharmacySearchTimerRef.current = setTimeout(() => {
        lastSearchedLocationRef.current = locationKey;
        searchPharmaciesByLocation(location);
      }, 800); // 800ms debounce for pharmacy searches
    },
    [searchPharmaciesByLocation]
  );

  // Update map center based on zipCode, city, or state
  useEffect(() => {
    const updateLocation = async () => {
      if (zipCode) {
        const location = await geocodeByZipCode(zipCode);
        if (location) {
          setMapCenter(location);
          debouncedPharmacySearch(location);
        }
      } else if (city && state) {
        const location = await geocodeByCityState(city, state);
        if (location) {
          setMapCenter(location);
          debouncedPharmacySearch(location);
        }
      }
    };

    updateLocation();
  }, [
    zipCode,
    city,
    state,
    geocodeByZipCode,
    geocodeByCityState,
    debouncedPharmacySearch,
  ]);

  // Debounce timer ref for pickup address geocoding
  const pickupGeocodeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Update pickup location from prop (when selected from map) or geocode from address in real-time
  useEffect(() => {
    // Clear any existing timer
    if (pickupGeocodeTimerRef.current) {
      clearTimeout(pickupGeocodeTimerRef.current);
    }

    if (pickupLocationProp) {
      // Use the location directly from prop (selected from map)
      setPickupLocation(pickupLocationProp);
      setMapCenter(pickupLocationProp);
      debouncedPharmacySearch(pickupLocationProp);
    } else if (pickupAddress && pickupAddress.trim().length > 0) {
      // Debounce geocoding to avoid too many requests while typing
      pickupGeocodeTimerRef.current = setTimeout(async () => {
        const location = await geocodeAddress(pickupAddress);
        if (location) {
          setPickupLocation(location);
          setMapCenter(location);
          debouncedPharmacySearch(location);
        } else {
          // If geocoding fails, keep the previous location or clear it
          // Don't clear if user is still typing
        }
      }, 500); // 500ms debounce delay
    } else {
      // Address is cleared - remove marker immediately
      setPickupLocation(null);
    }

    // Cleanup timer on unmount or when dependencies change
    return () => {
      if (pickupGeocodeTimerRef.current) {
        clearTimeout(pickupGeocodeTimerRef.current);
      }
    };
  }, [
    pickupAddress,
    pickupLocationProp,
    geocodeAddress,
    debouncedPharmacySearch,
  ]);

  // Debounce timer ref for dropoff address geocoding
  const dropoffGeocodeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Update dropoff location from prop (when selected from map) or geocode from address in real-time
  useEffect(() => {
    // Clear any existing timer
    if (dropoffGeocodeTimerRef.current) {
      clearTimeout(dropoffGeocodeTimerRef.current);
    }

    if (dropoffLocationProp) {
      // Use the location directly from prop (selected from map)
      setDropoffLocation(dropoffLocationProp);
      // Only update map center if pickup is not set
      if (!pickupLocation) {
        setMapCenter(dropoffLocationProp);
        debouncedPharmacySearch(dropoffLocationProp);
      }
    } else if (dropoffAddress && dropoffAddress.trim().length > 0) {
      // Debounce geocoding to avoid too many requests while typing
      dropoffGeocodeTimerRef.current = setTimeout(async () => {
        const location = await geocodeAddress(dropoffAddress);
        if (location) {
          setDropoffLocation(location);
          // Only update map center if pickup is not set
          if (!pickupLocation) {
            setMapCenter(location);
            debouncedPharmacySearch(location);
          }
        }
      }, 500); // 500ms debounce delay
    } else {
      // Address is cleared - remove marker immediately
      setDropoffLocation(null);
    }

    // Cleanup timer on unmount or when dependencies change
    return () => {
      if (dropoffGeocodeTimerRef.current) {
        clearTimeout(dropoffGeocodeTimerRef.current);
      }
    };
  }, [
    dropoffAddress,
    dropoffLocationProp,
    geocodeAddress,
    pickupLocation,
    debouncedPharmacySearch,
  ]);

  // Cleanup pharmacy search timer on unmount
  useEffect(() => {
    return () => {
      if (pharmacySearchTimerRef.current) {
        clearTimeout(pharmacySearchTimerRef.current);
      }
    };
  }, []);

  // When parent clears form (e.g. after closing out-of-coverage modal), clear local markers
  // so they disappear even when Redux was already empty and props didn't change
  useEffect(() => {
    if (markersResetKey !== undefined && markersResetKey > 0) {
      setPickupLocation(null);
      setDropoffLocation(null);
      onDistanceCalculated?.("", "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only clear when key changes
  }, [markersResetKey]);

  // Prefer external pharmacies if provided
  const pharmaciesToRender = pharmaciesProp ?? pharmacies;

  return (
    <div
      style={{ height: height === "100%" ? "100%" : height }}
      className="w-full h-full rounded-xl overflow-hidden relative"
    >
      {!mapsLoaded && !mapsError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-xl z-10">
          <p className="text-gray-500">Loading Google Maps...</p>
        </div>
      )}
      {mapsError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-xl z-10">
          <p className="text-red-500">
            Error loading Google Maps: {mapsError.message}
          </p>
        </div>
      )}
      {mapsLoaded && (
        <PharmacyMap
          pickupLocation={pickupLocation}
          dropoffLocation={dropoffLocation}
          pharmacies={pharmaciesToRender}
          center={mapCenter || undefined}
          onPharmacyClick={onPharmacyClick}
          onPharmacySelect={onPharmacySelect}
          showRoute={showRoute}
          onMapClick={(location, address) => {
            if (selectionMode === "pickup" && onPickupSelect) {
              // Update local state immediately for instant marker display
              setPickupLocation(location);
              onPickupSelect(location, address);
            } else if (selectionMode === "dropoff" && onDropoffSelect) {
              // Update local state immediately for instant marker display
              setDropoffLocation(location);
              onDropoffSelect(location, address);
            }
          }}
          selectionMode={selectionMode}
          onDistanceCalculated={onDistanceCalculated}
        />
      )}
      {pharmacyLoading && mapsLoaded && (
        <div className="absolute top-4 right-4 bg-white px-4 py-2 rounded-lg shadow-lg z-10">
          <p className="text-sm text-gray-600">Loading pharmacies...</p>
        </div>
      )}
      {locationDeniedOrError && mapsLoaded && (
        <div className="absolute bottom-4 left-4 bg-white px-4 py-2 rounded-lg shadow-lg z-10 border border-gray-200">
          <p className="text-sm text-gray-700">Please enable location to see Partner Pharmacies near you</p>
        </div>
      )}
    </div>
  );
}
