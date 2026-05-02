"use client";
import React, { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Loader } from "lucide-react";
import { useTranslations } from "next-intl";
import { LiaQuestionCircle } from "react-icons/lia";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import PricingBreakdownModal from "./pricingBreakdownModal";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import {
  selectCheckoutData,
  clearCheckoutData,
  setAdditionalInstructions,
} from "@/store/slices/checkoutSlice";
import {
  selectIsLoggedIn,
  selectUser,
} from "@/store/slices/userSlice/userSlice";
import { resetMapState, setSelectedPharmacy } from "@/store/slices/mapSlice";
import { useCreateCheckoutMutation } from "@/store/Apis/checkoutApi/checkOutApi";
import useShowToast from "@/hooks/useShowToast";

import Link from "next/link";
interface OrderSummaryProps {
  formData: {
    email: string;
    contactNumber: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
  };
  onPrevious: () => void;
  onComplete: () => void;
}

// Parse distance string to get numeric value in miles
const parseDistance = (distanceStr: string): number => {
  if (!distanceStr) return 0;

  // Extract number and unit from strings like "10 mi", "295 ft", "5.5 km", etc.
  const match = distanceStr.match(
    /(\d+\.?\d*)\s*(ft|feet|mi|miles|m|meters|km|kilometers|km|kilometres)?/i,
  );

  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = (match[2] || "").toLowerCase();

  // Convert to miles based on unit
  switch (unit) {
    case "ft":
    case "feet":
      // 1 mile = 5280 feet
      return value / 5280;
    case "m":
    case "meters":
      // 1 mile = 1609.34 meters
      return value / 1609.34;
    case "km":
    case "kilometers":
    case "kilometres":
      // 1 mile = 1.60934 km
      return value / 1.60934;
    case "mi":
    case "miles":
    default:
      // Already in miles or no unit specified (assume miles)
      return value;
  }
};

// Check if the selected time is during rush hour (11AM-1PM & 4PM-6PM on weekdays)
const isRushHour = (
  selectedTime: string | null,
  selectedDate: string | null,
): boolean => {
  if (!selectedTime || !selectedDate) return false;

  try {
    const date = new Date(selectedDate);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday

    // Only weekdays (Monday-Friday, 1-5)
    if (dayOfWeek === 0 || dayOfWeek === 6) return false;

    // Parse time from selectedTime (format might be "11:00 AM - 12:00 PM" or just "11:00 AM")
    const timeStr = selectedTime.split(" - ")[0]; // Get start time
    const timeMatch = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);

    if (!timeMatch) return false;

    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const period = timeMatch[3].toUpperCase();

    // Convert to 24-hour format
    if (period === "PM" && hours !== 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;

    // Check if time falls in rush hour windows
    // 11AM-1PM (11:00-13:00) or 4PM-6PM (16:00-18:00) - inclusive of end times
    const timeInMinutes = hours * 60 + minutes;
    const rushHour1Start = 11 * 60; // 11:00 AM
    const rushHour1End = 13 * 60; // 1:00 PM
    const rushHour2Start = 16 * 60; // 4:00 PM
    const rushHour2End = 18 * 60; // 6:00 PM

    return (
      (timeInMinutes >= rushHour1Start && timeInMinutes <= rushHour1End) ||
      (timeInMinutes >= rushHour2Start && timeInMinutes <= rushHour2End)
    );
  } catch {
    return false;
  }
};

// Calculate delivery fee based on distance and rush hour
// If pharmacy is a partner pharmacy (from database), delivery fee is $0
const calculateDeliveryFee = (
  distance: string,
  selectedTime: string | null,
  selectedDate: string | null,
  isPartnerPharmacy: boolean = false,
): number => {
  // Partner pharmacies have $0 delivery fee
  if (isPartnerPharmacy) {
    return 0;
  }

  const distanceInMiles = parseDistance(distance);
  let fee = 0;

  if (distanceInMiles <= 2) {
    fee = 5.99;
  } else {
    // $5.99 for first 2 miles + $1.89 per additional mile
    const additionalMiles = distanceInMiles - 2;
    fee = 5.99 + additionalMiles * 1.89;
  }

  // Add rush hour fee if applicable
  if (isRushHour(selectedTime, selectedDate)) {
    fee += 1.65;
  }

  return Math.round(fee * 100) / 100; // Round to 2 decimal places
};

// Format date for display
const formatDateDisplay = (dateStr: string | null): string => {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check if it's today
    if (date.toDateString() === today.toDateString()) {
      return "Today";
    }
    // Check if it's tomorrow
    if (date.toDateString() === tomorrow.toDateString()) {
      return "Tomorrow";
    }
    // Otherwise format as "MMM DD, YYYY"
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
};

// Format time for display
const formatTimeDisplay = (timeStr: string | null): string => {
  if (!timeStr) return "";
  // Return just the start time if it's a range
  return timeStr.split(" - ")[0];
};

// Convert time from "11:00 AM" format to "14:30" format (24-hour)
const convertTimeTo24Hour = (timeStr: string): string => {
  if (!timeStr) return "";

  try {
    // Extract start time if it's a range
    const time = timeStr.split(" - ")[0].trim();
    const match = time.match(/(\d+):(\d+)\s*(AM|PM)/i);

    if (!match) return "";

    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const period = match[3].toUpperCase();

    // Convert to 24-hour format
    if (period === "PM" && hours !== 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;

    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}`;
  } catch {
    return "";
  }
};

// Format date to YYYY-MM-DD format
const formatDateToAPI = (dateStr: string | null): string => {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch {
    return "";
  }
};

export default function OrderSummary({
  formData,
  onPrevious,
  onComplete,
}: OrderSummaryProps) {
  const t = useTranslations("orderSummary");
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState<boolean>(false);
  const [termsError, setTermsError] = useState<string>("");
  const dispatch = useAppDispatch();
  const checkoutData = useAppSelector(selectCheckoutData);
  const isLoggedIn = useAppSelector(selectIsLoggedIn);
  const user = useAppSelector(selectUser);
  const [createCheckout, { isLoading: isSubmitting }] =
    useCreateCheckoutMutation();
  const { showSuccess, showError } = useShowToast();

  // Safety check: Clear guest checkout data if user is logged in
  useEffect(() => {
    const currentUserId = user?._id || null;
    if (
      isLoggedIn &&
      currentUserId &&
      checkoutData.userId === null &&
      (checkoutData.email ||
        checkoutData.firstName ||
        checkoutData.pickupAddress ||
        checkoutData.dropoffAddress)
    ) {
      // User is logged in but checkout data is guest data - clear it immediately
      dispatch(clearCheckoutData());
      if (typeof window !== "undefined") {
        localStorage.removeItem("persist:checkout");
      }
    }
  }, [
    isLoggedIn,
    user?._id,
    checkoutData.userId,
    checkoutData.email,
    checkoutData.firstName,
    checkoutData.pickupAddress,
    checkoutData.dropoffAddress,
    dispatch,
  ]);

  // Campus Pharmacy exact identifiers
  const CAMPUS_PHARMACY_NAME = "campus pharmacy";
  const CAMPUS_PHARMACY_ADDRESS = "195 central ave, newark, nj 07103, usa";

  // Calculate prices
  const prices = useMemo(() => {
    // Check if pickup is Campus Pharmacy by matching name OR exact address (case-insensitive)
    const pickupNameLower = checkoutData.pickupName?.toLowerCase().trim() ?? "";
    const pickupAddressLower = checkoutData.pickupAddress?.toLowerCase().trim() ?? "";

    const isManualCampusPharmacy =
      pickupNameLower.includes(CAMPUS_PHARMACY_NAME) ||
      pickupAddressLower.includes(CAMPUS_PHARMACY_ADDRESS);

    const effectiveIsPartner =
      checkoutData.isPartnerPharmacy || isManualCampusPharmacy;

    // Calculate original delivery fee (what it would be without partner discount)
    const originalDeliveryFee = calculateDeliveryFee(
      checkoutData.distance,
      checkoutData.selectedTime,
      checkoutData.selectedDate,
      false, // Calculate as if not a partner pharmacy
    );

    // Actual delivery fee (0 for partner pharmacy, original for non-partner)
    const deliveryFee = effectiveIsPartner ? 0 : originalDeliveryFee;

    const serviceFee = 1.19; // Fixed service fee
    const total = deliveryFee + serviceFee;

    return {
      deliveryFee,
      originalDeliveryFee, // For display purposes when partner pharmacy
      serviceFee,
      total,
      isPartner: effectiveIsPartner,
    };
  }, [
    checkoutData.distance,
    checkoutData.selectedTime,
    checkoutData.selectedDate,
    checkoutData.isPartnerPharmacy,
    checkoutData.pickupName,
    checkoutData.pickupAddress,
  ]);

  // Handle checkout payment
  const handleCompletePayment = async () => {
    // Validate terms agreement
    if (!termsAgreed) {
      setTermsError("You must agree to the terms and conditions");
      return;
    }

    try {
      // Concatenate name with address if name exists
      const formatAddressWithName = (name: string, address: string): string => {
        if (name && name.trim()) {
          return `${name}, ${address}`;
        }
        return address;
      };

      // Prepare checkout request data
      const checkoutRequest = {
        ...(isLoggedIn && user._id && { userId: user._id }),
        typeUser: (isLoggedIn ? "registered" : "guest") as
          | "registered"
          | "guest",
        pickupAddress: formatAddressWithName(
          checkoutData.pickupName,
          checkoutData.pickupAddress,
        ),
        deliveryAddress: formatAddressWithName(
          checkoutData.dropoffName,
          checkoutData.dropoffAddress,
        ),
        deliveryDate: formatDateToAPI(checkoutData.selectedDate),
        deliveryTime: convertTimeTo24Hour(checkoutData.selectedTime || ""),
        email: checkoutData.email || formData.email,
        phone: checkoutData.contactNumber || formData.contactNumber,
        legalName: `${checkoutData.firstName || formData.firstName} ${
          checkoutData.lastName || formData.lastName
        }`,
        deliveryInstruction: checkoutData.additionalInstructions || "",
        dateOfBirth: formatDateToAPI(
          checkoutData.dateOfBirth || formData.dateOfBirth,
        ),
        amount: prices.total,
        serviceCharge: prices.serviceFee,
        deliveryCharge: prices.deliveryFee,
      };

      // Validate required fields
      if (!checkoutRequest.pickupAddress || !checkoutRequest.deliveryAddress) {
        showError({
          message: "Please ensure pickup and delivery addresses are selected",
        });
        return;
      }

      if (!checkoutRequest.deliveryDate || !checkoutRequest.deliveryTime) {
        showError({
          message: "Please ensure delivery date and time are selected",
        });
        return;
      }

      if (
        !checkoutRequest.email ||
        !checkoutRequest.phone ||
        !checkoutRequest.legalName ||
        !checkoutRequest.dateOfBirth
      ) {
        showError({
          message: "Please ensure all contact details are filled",
        });
        return;
      }

      // Call the checkout API
      const response = await createCheckout(checkoutRequest).unwrap();

      if (response.success) {
        showSuccess({
          message: response.message || "Redirecting to payment...",
        });

        // Clear checkout data from Redux slice after successful checkout
        dispatch(clearCheckoutData());

        // Reset map state to clear all map data (addresses, locations, distance, duration)
        dispatch(resetMapState());
        dispatch(setSelectedPharmacy(null));

        // Redirect to Stripe checkout URL in the same tab (no new tab)
        if (response.data?.url) {
          window.location.href = response.data.url;
        }

        // router.push("/");

        // Call the original onComplete callback
        onComplete();
      } else {
        showError({
          message:
            response.error ||
            response.message ||
            "Failed to complete checkout. Please try again.",
        });
      }
    } catch (error: unknown) {
      console.error("Checkout error:", error);
      let errorMessage = "Failed to complete checkout. Please try again.";

      if (error && typeof error === "object") {
        if ("data" in error && error.data && typeof error.data === "object") {
          const data = error.data as { message?: string; error?: string };
          errorMessage = data.message || data.error || errorMessage;
        } else if ("message" in error && typeof error.message === "string") {
          errorMessage = error.message;
        }
      }

      showError({
        message: errorMessage,
      });
    }
  };

  return (
    <div className="px-6 relative min-h-[600px]">
      <div className="flex items-center gap-3 mb-6 relative z-20">
        <Button
          onClick={onPrevious}
          variant="outline"
          size="sm"
          className="p-2"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-2xl font-bold text-gray-900">{t("title")}</h2>
      </div>

      <div className="space-y-4 relative z-20">
        {/* Contact and Delivery Details */}
        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b border-gray-200">
            <span className="text-gray-600">{t("details.name")}</span>
            <span className="font-medium">
              {checkoutData.firstName || formData.firstName}{" "}
              {checkoutData.lastName || formData.lastName}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-200">
            <span className="text-gray-600">{t("details.contactNumber")}</span>
            <span className="font-medium">
              {checkoutData.contactNumber || formData.contactNumber}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-200">
            <span className="text-gray-600">{t("details.pickupAddress")}</span>
            <span className="font-medium text-right">
              {checkoutData.pickupName && checkoutData.pickupName.trim() ? (
                <span>
                  <span className="font-semibold">
                    {checkoutData.pickupName}
                  </span>
                  <br />
                  <span className="text-sm text-gray-600">
                    {checkoutData.pickupAddress || "Not selected"}
                  </span>
                </span>
              ) : (
                checkoutData.pickupAddress || "Not selected"
              )}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-200">
            <span className="text-gray-600">{t("details.deliverAddress")}</span>
            <span className="font-medium text-right">
              {checkoutData.dropoffName && checkoutData.dropoffName.trim() ? (
                <span>
                  <span className="font-semibold">
                    {checkoutData.dropoffName}
                  </span>
                  <br />
                  <span className="text-sm text-gray-600">
                    {checkoutData.dropoffAddress || "Not selected"}
                  </span>
                </span>
              ) : (
                checkoutData.dropoffAddress || "Not selected"
              )}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-200">
            <span className="text-gray-600">{t("details.distance")}</span>
            <span className="font-medium">
              {checkoutData.distance || "Not calculated"}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-200">
            <span className="text-gray-600">{t("details.date")}</span>
            <span className="font-medium">
              {checkoutData.selectedDate
                ? formatDateDisplay(checkoutData.selectedDate)
                : t("details.today")}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-200">
            <span className="text-gray-600">{t("details.time")}</span>
            <span className="font-medium">
              {checkoutData.selectedTime
                ? formatTimeDisplay(checkoutData.selectedTime)
                : t("details.now")}
            </span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-gray-600">
              {t("details.additionalInstructions")}{" "}
            </span>
            <span className="font-medium">
              <Tooltip>
                <TooltipTrigger asChild>
                  <LiaQuestionCircle
                    size={20}
                    className="text-peter cursor-pointer"
                  />
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  className="max-w-xs text-gray-800 bg-gray-100"
                >
                  <div className="space-y-2">
                    <p className="text-sm">{t("tooltip.title")}</p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      <li>{t("tooltip.items.rxCount")}</li>
                      <li>{t("tooltip.items.gateCodes")}</li>
                    </ul>
                    <p className="text-xs mt-2">{t("tooltip.disclaimer")}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </span>
          </div>
          <Textarea
            className="w-full h-24"
            placeholder={t("details.additionalInstructionsPlaceholder")}
            value={checkoutData.additionalInstructions}
            onChange={(e) =>
              dispatch(setAdditionalInstructions(e.target.value))
            }
          />
        </div>

        {/* Price Details */}
        <div className="mt-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            {t("priceDetails.title")}
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-gray-600">
                {t("priceDetails.deliveryFee")}
              </span>
              <div className="flex items-center gap-2">
                {prices.isPartner && prices.originalDeliveryFee > 0 && (
                  <span className="text-gray-400 line-through text-sm">
                    ${prices.originalDeliveryFee.toFixed(2)}
                  </span>
                )}
                <span className="font-medium">
                  ${prices.deliveryFee.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-gray-600">
                {t("priceDetails.serviceFee")}
              </span>
              <span className="font-medium">
                ${prices.serviceFee.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between py-2 border-b-2 border-gray-300">
              <span className="text-lg font-semibold text-gray-900">
                {t("priceDetails.totalUSD")}
              </span>
              <span className="text-lg font-bold text-gray-900">
                ${prices.total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <Button
          variant="link"
          className="text-peter hover:underline -ml-4"
          onClick={() => setIsPricingModalOpen(true)}
        >
          {t("seePricingBreakdown")}
        </Button>

        {/* Legal Agreement Checkbox */}
        <div className="flex items-start gap-3">
          <Checkbox
            id="terms-agreement-summary"
            checked={termsAgreed}
            onCheckedChange={(checked) => {
              setTermsAgreed(checked === true);
              if (termsError) {
                setTermsError("");
              }
            }}
            className={`mt-1 ${termsError ? "border-red-500" : ""}`}
          />
          <label
            htmlFor="terms-agreement-summary"
            className="text-sm text-gray-600 leading-relaxed cursor-pointer"
          >
            {t("legalAgreement.text")}{" "}
            <Link
              href="/policies/terms-of-service"
              target="_blank"
              rel="noopener noreferrer"
              className="text-peter hover:underline"
              onClick={(e: React.MouseEvent<HTMLAnchorElement>) =>
                e.stopPropagation()
              }
            >
              {t("legalAgreement.termsOfService")}
            </Link>
            , {t("legalAgreement.acknowledge")}{" "}
            <Link
              href="/policies/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-peter hover:underline"
              onClick={(e: React.MouseEvent<HTMLAnchorElement>) =>
                e.stopPropagation()
              }
            >
              {t("legalAgreement.privacyPolicy")}
            </Link>
            .
          </label>
        </div>
        {termsError && (
          <p className="text-red-500 text-xs mt-1">{termsError}</p>
        )}

        {/* Complete Payment Button */}
        <Button
          onClick={handleCompletePayment}
          disabled={isSubmitting || !termsAgreed}
          className={`w-full py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed ${
            termsAgreed && !isSubmitting
              ? "bg-peter hover:bg-peter-dark text-white"
              : "bg-gray-300 text-gray-500"
          }`}
        >
          {isSubmitting ? (
            <>
              <p className="flex items-center justify-center gap-2">
                Processing...
                <Loader className="animate-spin size-4 text-peter" />
              </p>
            </>
          ) : (
            t("completePayment")
          )}
        </Button>
      </div>

      {/* Watermark */}
      <div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none z-0">
        <Image
          src="/watermark.webp"
          alt="watermark"
          width={1000}
          height={1000}
          className="object-contain w-60 h-60 -rotate-45 opacity-100"
        />
      </div>

      {/* Pricing Breakdown Modal */}
      <PricingBreakdownModal
        isOpen={isPricingModalOpen}
        onClose={() => setIsPricingModalOpen(false)}
      />
    </div>
  );
}
