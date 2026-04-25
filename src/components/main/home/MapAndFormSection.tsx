"use client";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  MapPin,
  Calendar,
  Clock,
  // ShoppingCart,
  // ChevronRight,
  ShoppingCart,
  Map,
} from "lucide-react";
import { FaSortDown } from "react-icons/fa";
import { Card } from "@/components/ui/card";
import DatePickerModal from "@/components/ui/date-picker-modal";
import TimePickerModal from "@/components/ui/time-picker-modal";
import LocationPickerModal from "@/components/main/home/location-picker-modal";
import NewCustomerModal from "./checkUserStatusModal";
import OutOfCoverageModal from "./OutOfCoverageModal";
import { validateAddressCoverage } from "@/lib/coverageValidation";
import { useGetCoverageZipcodeQuery } from "@/store/Apis/mapApi/pharmapApi";
import {
  selectIsLoggedIn,
  selectUser,
} from "@/store/slices/userSlice/userSlice";
import { useRouter } from "next/navigation";
import { Label } from "@radix-ui/react-label";
import { useTranslations } from "next-intl";
import MapComponent from "./Map";
import GoogleMapsProvider from "./Map/GoogleMapsProvider";
import AddressAutocomplete from "./Map/AddressAutocomplete";
import { Location, Pharmacy } from "./Map/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  setPickupAddress,
  setDropoffAddress,
  setPickupName,
  setDropoffName,
  setPickupLocation,
  setDropoffLocation,
  setZipCode,
  setCity,
  setState,
  setCurrentLocation,
  setDistance,
  setDuration,
  setSelectedPharmacy,
} from "@/store/slices/mapSlice";
import {
  useGetPharmaciesQuery,
  useLazyGetPharmaciesQuery,
} from "@/store/Apis/mapApi/pharmapApi";
import { RiResetLeftLine } from "react-icons/ri";
import { setCheckoutData } from "@/store/slices/checkoutSlice";
import { toast } from "sonner";
export default function MapAndFormSection() {
  const t = useTranslations("home.mapAndFormSection");
  const tForm = useTranslations("home.form");
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector(selectUser);
  const { data: coverageZipcodeData } = useGetCoverageZipcodeQuery(
    { limit: 10000 },
    { refetchOnMountOrArgChange: true },
  );

  const coverageZipcode = useMemo(() => {
    if (!coverageZipcodeData?.data?.length) return [];
    return coverageZipcodeData.data.map((item) => item.zipCode);
  }, [coverageZipcodeData]);

  // Redux state
  const pickupAddress = useAppSelector((state) => state.map.pickupAddress);
  const dropoffAddress = useAppSelector((state) => state.map.dropoffAddress);
  const pickupName = useAppSelector((state) => state.map.pickupName);
  const dropoffName = useAppSelector((state) => state.map.dropoffName);
  const pickupLocationCoords = useAppSelector(
    (state) => state.map.pickupLocation,
  );
  const dropoffLocationCoords = useAppSelector(
    (state) => state.map.dropoffLocation,
  );
  const zipCode = useAppSelector((state) => state.map.zipCode);
  const city = useAppSelector((state) => state.map.city);
  const state = useAppSelector((state) => state.map.state);
  const currentLocation = useAppSelector((state) => state.map.currentLocation);
  const distance = useAppSelector((state) => state.map.distance);
  const duration = useAppSelector((state) => state.map.duration);
  const selectedPharmacy = useAppSelector(
    (state) => state.map.selectedPharmacy,
  );

  // Fetch pharmacies from API based on zip/city/state
  const {
    data: pharmaciesResponse,
    isLoading: pharmaciesLoading,
    isError: pharmaciesIsError,
  } = useGetPharmaciesQuery(
    { postCode: zipCode, city, state },
    {
      // Skip when we don't have enough data to query
      // Run when we have a zipCode OR both city and state
      skip: !(zipCode || (city && state)),
    },
  );

  const [triggerGetPharmacies] = useLazyGetPharmaciesQuery();

  const pharmaciesFromApi = useMemo(() => {
    if (!pharmaciesResponse?.data) return [];
    return pharmaciesResponse.data.map((p) => ({
      id: p._id,
      name: p.name,
      address: p.address,
      phone: p.phone,
      logo: p.logo,
      isPartner: true, // Pharmacies from database are partner pharmacies
      location: {
        lat: p.latitude ?? p.location.coordinates?.[1],
        lng: p.longitude ?? p.location.coordinates?.[0],
      },
    }));
  }, [pharmaciesResponse]);

  // Local state for UI
  const [deliveryTime, setDeliveryTime] = useState("today");
  const [deliverySpeed, setDeliverySpeed] = useState("now");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date(),
  );
  const [selectedTime, setSelectedTime] = useState<string | undefined>(
    undefined,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mapSelectionMode, setMapSelectionMode] = useState<
    "pickup" | "dropoff" | null
  >(null);
  const [displayedPharmacies, setDisplayedPharmacies] = useState<Pharmacy[]>(
    [],
  );
  // Out-of-coverage modal: show when user selects pickup/dropoff outside coverage
  const [outOfCoverageModal, setOutOfCoverageModal] = useState<{
    open: boolean;
    context: "pickup" | "dropoff";
    zipcode: string | null;
  }>({ open: false, context: "pickup", zipcode: null });
  // Key to force Map to clear local markers when modal closes (Redux may already be empty)
  const [markersResetKey, setMarkersResetKey] = useState(0);

  const router = useRouter();
  const isLoggedIn = useAppSelector(selectIsLoggedIn);

  // Function to randomly select pharmacies for display
  const selectRandomPharmacies = useCallback((pharmacies: Pharmacy[]) => {
    if (pharmacies.length === 0) {
      setDisplayedPharmacies([]);
      return;
    }

    if (pharmacies.length <= 2) {
      // If 2 or fewer, show all of them
      setDisplayedPharmacies([...pharmacies]);
    } else {
      // If more than 2, randomly select 2
      const shuffled = [...pharmacies].sort(() => Math.random() - 0.5);
      setDisplayedPharmacies(shuffled.slice(0, 2));
    }
  }, []);

  // Update displayed pharmacies when pharmaciesFromApi changes
  useEffect(() => {
    if (pharmaciesFromApi.length > 0) {
      selectRandomPharmacies(pharmaciesFromApi);
    } else {
      setDisplayedPharmacies([]);
    }
  }, [pharmaciesFromApi, selectRandomPharmacies]);

  // Refresh displayed pharmacies every 5 minutes
  useEffect(() => {
    if (pharmaciesFromApi.length <= 2) {
      // No need to refresh if we're showing all pharmacies
      return;
    }

    const interval = setInterval(
      () => {
        selectRandomPharmacies(pharmaciesFromApi);
      },
      5 * 60 * 1000,
    ); // 5 minutes in milliseconds

    return () => clearInterval(interval);
  }, [pharmaciesFromApi, selectRandomPharmacies]);

  // Parse location string to extract zipcode, city, state using geocoding
  useEffect(() => {
    const parseLocation = async () => {
      if (!currentLocation || typeof window === "undefined" || !window.google) {
        return;
      }

      // First try simple regex parsing
      const zipMatch = currentLocation.match(/\b\d{5}\b/);
      if (zipMatch) {
        dispatch(setZipCode(zipMatch[0]));
      }

      const cityStateMatch = currentLocation.match(
        /([^,]+),\s*([A-Z]{2})\s+\d{5}/,
      );
      if (cityStateMatch) {
        dispatch(setCity(cityStateMatch[1].trim()));
        dispatch(setState(cityStateMatch[2].trim()));
      }

      // Also use geocoding to get more accurate location details
      try {
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ address: currentLocation }, (results, status) => {
          if (status === "OK" && results && results[0]) {
            const addressComponents = results[0].address_components;

            // Extract zipcode
            const postalCode = addressComponents.find((component) =>
              component.types.includes("postal_code"),
            );
            if (postalCode) {
              dispatch(setZipCode(postalCode.long_name));
            }

            // Extract city
            const cityComponent = addressComponents.find(
              (component) =>
                component.types.includes("locality") ||
                component.types.includes("sublocality") ||
                component.types.includes("sublocality_level_1"),
            );
            if (cityComponent) {
              dispatch(setCity(cityComponent.long_name));
            }

            // Extract state
            const stateComponent = addressComponents.find((component) =>
              component.types.includes("administrative_area_level_1"),
            );
            if (stateComponent) {
              dispatch(setState(stateComponent.short_name));
            }
          }
        });
      } catch (error) {
        // console.error("Error geocoding location:", error);
      }
    };

    parseLocation();
  }, [currentLocation, dispatch]);

  const checkIsLoggedIn = () => {
    return isLoggedIn;
  };

  // console.log("checkIsLoggedIn", checkIsLoggedIn());

  const handleRedirect = () => {
    // Validation checks
    if (!pickupAddress || !pickupLocationCoords) {
      toast.error("Please select a pickup location");
      return;
    }

    if (!dropoffAddress || !dropoffLocationCoords) {
      toast.error("Please select a delivery address");
      return;
    }

    if (!selectedDate) {
      toast.error("Please select a delivery date");
      return;
    }

    if (!selectedTime) {
      toast.error("Please select a delivery time");
      return;
    }

    // Save checkout data to Redux persist
    const currentUserId = currentUser?._id || null;
    dispatch(
      setCheckoutData({
        userId: currentUserId,
        pickupAddress,
        dropoffAddress,
        pickupName,
        dropoffName,
        pickupLocation: pickupLocationCoords,
        dropoffLocation: dropoffLocationCoords,
        selectedDate: selectedDate.toISOString(),
        selectedTime,
        distance: distance || "",
        duration: duration || "",
        zipCode,
        city,
        state,
        selectedPharmacyId: selectedPharmacy?.id || null,
        isPartnerPharmacy: selectedPharmacy?.isPartner || false,
      }),
    );

    // Proceed to checkout
    if (checkIsLoggedIn()) {
      router.push("/checkout-details");
    } else {
      setIsModalOpen(true);
    }
  };

  const handlePickupSelect = async (location: Location, address: string, name?: string) => {
    if (coverageZipcode.length > 0) {
      const result = await validateAddressCoverage(location, coverageZipcode);
      if (!result.valid) {
        setOutOfCoverageModal({
          open: true,
          context: "pickup",
          zipcode: result.zipcode,
        });
        setMapSelectionMode(null);
        return;
      }
    }
    dispatch(setPickupAddress(address));
    dispatch(setPickupLocation(location));
    dispatch(setPickupName(name || ""));
    dispatch(setSelectedPharmacy(null));
    setMapSelectionMode(null);
  };

  const handleDropoffSelect = async (location: Location, address: string, name?: string) => {
    if (coverageZipcode.length > 0) {
      const result = await validateAddressCoverage(location, coverageZipcode);
      if (!result.valid) {
        setOutOfCoverageModal({
          open: true,
          context: "dropoff",
          zipcode: result.zipcode,
        });
        setMapSelectionMode(null);
        return;
      }
    }
    dispatch(setDropoffAddress(address));
    dispatch(setDropoffLocation(location));
    dispatch(setDropoffName(name || ""));
    setMapSelectionMode(null);
  };

  const handlePharmacyClick = (pharmacy: Pharmacy) => {
    // console.log("Pharmacy clicked:", pharmacy);
    // You can add modal or navigation logic here
  };

  const handlePharmacySelect = (pharmacy: Pharmacy) => {
    // Set the pharmacy location as pickup location
    const location: Location = {
      lat: pharmacy.location.lat,
      lng: pharmacy.location.lng,
      address: pharmacy.address,
    };
    // Set pickup address and name
    dispatch(setPickupAddress(pharmacy.address));
    dispatch(setPickupName(pharmacy.name));
    dispatch(setPickupLocation(location));

    // Save selected pharmacy to Redux map state
    dispatch(setSelectedPharmacy(pharmacy));
    setMapSelectionMode(null); // Reset selection mode after selection
  };

  const handleDistanceCalculated = (distance: string, duration: string) => {
    dispatch(setDistance(distance));
    dispatch(setDuration(duration));
  };

  const handleResetLocations = () => {
    dispatch(setPickupAddress(""));
    dispatch(setDropoffAddress(""));
    dispatch(setPickupName(""));
    dispatch(setDropoffName(""));
    dispatch(setPickupLocation(null));
    dispatch(setDropoffLocation(null));
    dispatch(setDistance(null));
    dispatch(setDuration(null));
    setSelectedDate(undefined);
    setSelectedTime(undefined);
    setMapSelectionMode(null);
  };

  // Helper function to format display value with name
  const formatDisplayValue = (name: string, address: string): string => {
    if (name && name.trim()) {
      return `${name} - ${address}`;
    }
    return address;
  };

  return (
    <GoogleMapsProvider>
      <div className="flex flex-col lg:flex-row bg-gray-50 pt-4 sm:pt-8 lg:px-4 px-0 pb-4 sm:pb-8 gap-x-16 gap-y-4 sm:gap-y-8 ">
        {/* Left Section - Form - z-0 keeps autocomplete dropdown below navbar when scrolling */}
        <div className="relative z-0 w-full lg:w-1/2 px-4 lg:px-8 py-6 overflow-y-auto bg-white rounded-xl ">
          <div className="max-w-full">
            {/* Address Header */}
            <div className="mb-6">
              <div className="flex flex-col-reverse sm:flex-row items-center sm:items-start gap-2 text-sm text-gray-600 mb-4">
                <span className="flex items-center justify-start sm:justify-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {currentLocation}
                </span>
                <button
                  onClick={() => setIsLocationPickerOpen(true)}
                  className="text-peter hover:text-peter-dark sm:ml-2 hover:underline cursor-pointer"
                >
                  {t("changeCityOrZipCode")}
                </button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <h1
                  id="request-your-rx-delivered-in-minutes"
                  className="hidden sm:block text-2xl lg:text-xl 2xl:text-2xl font-bold text-gray-900 "
                >
                  {t("title")}
                </h1>
                <h1
                  id="request-your-rx-delivered-in-minutes"
                  className="block sm:hidden text-2xl lg:text-xl 2xl:text-2xl font-medium text-gray-900 text-center"
                >
                  {t("titleforMobileView")}
                </h1>
                <button
                  onClick={handleResetLocations}
                  className="text-peter hover:text-peter-dark flex items-center gap-2 text-sm font-semibold cursor-pointer"
                  title="Reset pickup and dropoff locations"
                  aria-label="Reset locations"
                >
                  <RiResetLeftLine className="w-5 h-5" />
                  <span className="hidden sm:inline">Reset</span>
                </button>
              </div>
            </div>

            {/* Pickup Location - overflow-visible so dropdown is not clipped */}
            <div className="relative overflow-visible">
              <Card className="mb-4 p-4 border-2 border-gray-200 hover:border-[#be95be] cursor-pointer transition-colors overflow-visible">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 w-10/12">
                    <div className="w-4.5 h-4 rounded-full bg-black"></div>
                    <div className="w-full relative">
                      <AddressAutocomplete
                        value={formatDisplayValue(pickupName, pickupAddress)}
                        onChange={(value) => {
                          // When user types, extract name and address
                          if (value.includes(" - ")) {
                            const [name, ...addressParts] = value.split(" - ");
                            dispatch(setPickupName(name.trim()));
                            dispatch(setPickupAddress(addressParts.join(" - ").trim()));
                          } else {
                            dispatch(setPickupName(""));
                            dispatch(setPickupAddress(value));
                          }
                        }}
                        onSelect={handlePickupSelect}
                        placeholder={tForm("pickupLocation")}
                        className="bg-transparent border-none outline-none placeholder:text-gray-400 text-gray-700 w-full"
                        zipCode={zipCode}
                        city={city}
                        state={state}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMapSelectionMode(
                          mapSelectionMode === "pickup" ? null : "pickup",
                        );
                      }}
                      className={`p-1.5 rounded transition-colors ${
                        mapSelectionMode === "pickup"
                          ? "bg-peter text-white"
                          : "text-gray-400 hover:text-peter hover:bg-gray-100"
                      }`}
                      title="Click on map to select pickup location"
                    >
                      <Map className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>

              {/* Drop-off Address */}
              <Card className="mb-6 p-4 border-2 border-gray-200 hover:border-[#be95be] cursor-pointer transition-colors overflow-visible">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 w-10/12">
                    <div className="w-4 h-4 bg-peter flex items-center justify-center border border-black">
                      <span className="w-1 h-1 bg-black  z-10"></span>
                    </div>
                    <div className="w-full relative">
                      <AddressAutocomplete
                        value={formatDisplayValue(dropoffName, dropoffAddress)}
                        onChange={(value) => {
                          // When user types, extract name and address
                          if (value.includes(" - ")) {
                            const [name, ...addressParts] = value.split(" - ");
                            dispatch(setDropoffName(name.trim()));
                            dispatch(setDropoffAddress(addressParts.join(" - ").trim()));
                          } else {
                            dispatch(setDropoffName(""));
                            dispatch(setDropoffAddress(value));
                          }
                        }}
                        onSelect={handleDropoffSelect}
                        placeholder={tForm("dropoffAddress")}
                        className="bg-transparent border-none outline-none placeholder:text-gray-400 text-gray-700 w-full"
                        zipCode={zipCode}
                        city={city}
                        state={state}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMapSelectionMode(
                          mapSelectionMode === "dropoff" ? null : "dropoff",
                        );
                      }}
                      className={`p-1.5 rounded transition-colors ${
                        mapSelectionMode === "dropoff"
                          ? "bg-peter text-white"
                          : "text-gray-400 hover:text-peter hover:bg-gray-100"
                      }`}
                      title="Click on map to select dropoff location"
                    >
                      <Map className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
              <div className="absolute top-15.5 left-6 border-l-3 border-gray-200 h-5 "></div>
            </div>
            {/* Delivery Time Options */}
            <div className="grid grid-cols-2 gap-4 mb-6 ">
              <div className="w-full flex flex-col items-start gap-2 ">
                <Label className="text-md text-gray-600">{tForm("date")}</Label>
                <button
                  onClick={() => setIsDatePickerOpen(true)}
                  className={`p-4 rounded-lg border-2 transition-all cursor-pointer hover:border-[#be95be] w-full ${
                    deliveryTime === "today"
                      ? "border-peter bg-peter/10"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-gray-600" />
                    <span className="font-medium text-gray-900">
                      {selectedDate
                        ? selectedDate.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })
                        : tForm("today")}
                    </span>
                  </div>
                </button>
              </div>
              <div className="w-full flex flex-col items-start gap-2 ">
                <Label className="text-md text-gray-600">{tForm("time")}</Label>
                <button
                  onClick={() => setIsTimePickerOpen(true)}
                  className={`p-4 rounded-lg border-2 transition-all cursor-pointer hover:border-[#be95be] w-full ${
                    deliverySpeed === "now"
                      ? "border-peter bg-peter/10"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center  justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-gray-600" />
                      <span className="font-medium text-gray-900">
                        {selectedTime
                          ? selectedTime.split(" - ")[0] // Show just the start time
                          : tForm("now")}
                      </span>
                    </div>

                    <FaSortDown className="w-4 h-4 text-gray-600 -mt-2" />
                  </div>
                </button>
              </div>
            </div>

            {/* Checkout Button */}
            <button
              className="w-full bg-peter hover:bg-peter-dark text-white  h-12 rounded-lg text-lg font-semibold shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              onClick={() => handleRedirect()}
            >
              <ShoppingCart className="w-5 h-5 mr-2" />
              {/* <p className="w-5 h-5 flex items-center justify-center mr-2">
              {useIcon({ name: "cart" })}
            </p> */}
              {/* <TiShoppingCart size={20} /> */}
              {tForm("checkoutRequest")}
            </button>

            {/* Pharmacy Suggestions */}
            {displayedPharmacies.length > 0 ? (
              <div className="mt-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  {t("pharmacySuggestions")}
                </h2>
                <div className="space-y-3">
                  {displayedPharmacies.map((pharmacy) => (
                    <Card
                      key={pharmacy.id}
                      className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => handlePharmacySelect(pharmacy)}
                    >
                      <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-red-500 mt-1" />
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {pharmacy.name}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {pharmacy.address}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  {t("pharmacySuggestions")}
                </h2>
                <h2 className="text-xl font-noraml text-gray-500 mb-4">
                  {t("noPharmaciesFound")}
                </h2>
              </div>
            )}
          </div>
        </div>

        <p className="text-sm text-gray-500 px-4 md:px-0 md:hidden">
          {t("pleaseZoomToSelectPharmacy")}
        </p>
        {/* Right Section - Map - Visible on all devices */}
        <div className="flex w-full lg:w-1/2 px-4 md:px-0 relative rounded-xl h-[400px] sm:h-[450px] md:h-[500px] lg:h-auto lg:min-h-[600px]">
          <MapComponent
            pickupAddress={pickupAddress}
            dropoffAddress={dropoffAddress}
            pickupLocation={pickupLocationCoords}
            dropoffLocation={dropoffLocationCoords}
            zipCode={zipCode}
            city={city}
            state={state}
            pharmacies={pharmaciesFromApi}
            onPharmacyClick={handlePharmacyClick}
            onPharmacySelect={handlePharmacySelect}
            showRoute={!!pickupLocationCoords && !!dropoffLocationCoords}
            height="100%"
            onPickupSelect={handlePickupSelect}
            onDropoffSelect={handleDropoffSelect}
            selectionMode={mapSelectionMode}
            onDistanceCalculated={handleDistanceCalculated}
            markersResetKey={markersResetKey}
            onUserLocationDetected={(address) =>
              dispatch(setCurrentLocation(address))
            }
          />
          {mapSelectionMode && (
            <div className="absolute top-4 left-4 bg-white px-4 py-2 rounded-lg shadow-lg z-10 border-2 border-peter">
              <p className="text-sm font-semibold text-peter">
                {mapSelectionMode === "pickup"
                  ? "Click on the map to select pickup location"
                  : "Click on the map to select dropoff location"}
              </p>
              <button
                onClick={() => setMapSelectionMode(null)}
                className="mt-2 text-xs text-gray-600 hover:text-gray-900 underline"
              >
                Cancel
              </button>
            </div>
          )}
          {/* Distance Display */}
          {distance && duration && (
            <div className="absolute top-4 left-4 bg-white px-4 py-3 rounded-lg shadow-lg z-10 border-l-4 border-peter">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-peter" />
                  <span className="text-sm font-semibold text-gray-900">
                    Distance: {distance}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-peter" />
                  <span className="text-sm font-semibold text-gray-900">
                    Estimated Time: {duration}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Pharmacies Loading / Error */}
          {pharmaciesLoading && (
            <div className="absolute top-4 right-4 bg-white px-3 py-2 rounded-lg shadow-md z-10 border border-gray-200 text-sm text-gray-700">
              Loading pharmacies...
            </div>
          )}
          {/* {!pharmaciesLoading && displayedPharmacies.length === 0 && (
            <div className="absolute top-4 right-4 bg-white px-3 py-2 rounded-lg shadow-md z-10 border border-gray-200 text-sm text-gray-700">
              {t("noPharmaciesFound")}
            </div>
          )} */}

          {pharmaciesIsError && (
            <div className="absolute top-4 right-4 bg-white px-3 py-2 rounded-lg shadow-md z-10 border border-red-200 text-sm text-red-700">
              {pharmaciesIsError
                ? t("errorLoadingPharmacies")
                : t("errorLoadingPharmacies")}
            </div>
          )}
        </div>

        {/* Date Picker Modal */}
        <DatePickerModal
          isOpen={isDatePickerOpen}
          onClose={() => setIsDatePickerOpen(false)}
          onDateSelect={(date) => {
            setSelectedDate(date);
            setDeliveryTime("today");
          }}
          selectedDate={selectedDate}
        />

        {/* Time Picker Modal */}
        <TimePickerModal
          isOpen={isTimePickerOpen}
          onClose={() => setIsTimePickerOpen(false)}
          onTimeSelect={(time) => {
            setSelectedTime(time);
            setDeliverySpeed("now");
          }}
          selectedTime={selectedTime}
          selectedDate={selectedDate}
        />

        {/* Location Picker Modal */}
        <LocationPickerModal
          isOpen={isLocationPickerOpen}
          onClose={() => setIsLocationPickerOpen(false)}
          onLocationSelect={(location) => {
            dispatch(setCurrentLocation(location));
          }}
          currentLocation={currentLocation}
          onUpdateLocation={async (newLocation) => {
            const zipMatch = newLocation.match(/\b\d{5}(-\d{4})?\b/);
            const postCode = zipMatch ? zipMatch[0] : newLocation.trim();
            if (!postCode)
              return {
                success: false,
                message: "Please enter a valid ZIP code.",
              };
            const result = await triggerGetPharmacies({
              postCode,
              city: "",
              state: "",
            });
            if (result.isError && result.error) {
              const err = result.error as {
                status?: number;
                data?: { message?: string; err?: { message?: string } };
              };
              const is404 = err.status === 404;
              const msg = err.data?.err?.message ?? err.data?.message ?? "";
              if (
                is404 ||
                msg.toLowerCase().includes("postcode") ||
                msg.toLowerCase().includes("coverage")
              ) {
                return { success: false, message: msg || undefined };
              }
            }
            dispatch(setCurrentLocation(newLocation));
            return { success: true };
          }}
        />

        {/* New Customer Modal */}
        <NewCustomerModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          description={t("modalDescription")}
        />

        {/* Out of coverage modal (pickup/dropoff outside service area) */}
        <OutOfCoverageModal
          isOpen={outOfCoverageModal.open}
          onClose={() => {
            setOutOfCoverageModal((prev) => ({ ...prev, open: false }));
            // Clear both pickup and dropoff so form is in empty state
            dispatch(setPickupAddress(""));
            dispatch(setDropoffAddress(""));
            dispatch(setPickupName(""));
            dispatch(setDropoffName(""));
            dispatch(setPickupLocation(null));
            dispatch(setDropoffLocation(null));
            dispatch(setDistance(null));
            dispatch(setDuration(null));
            dispatch(setSelectedPharmacy(null));
            setMapSelectionMode(null);
            // Force Map to clear its local markers (they may persist when Redux was already empty)
            setMarkersResetKey((k) => k + 1);
          }}
          context={outOfCoverageModal.context}
          zipcode={outOfCoverageModal.zipcode}
        />
      </div>
    </GoogleMapsProvider>
  );
}
