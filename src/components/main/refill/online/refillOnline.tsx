"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { ChevronDownIcon, Loader } from "lucide-react";
import Link from "next/link";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import React, { useEffect, useState } from "react";
import {
  useForm,
  useFieldArray,
  Controller,
  SubmitHandler,
} from "react-hook-form";
import { useTranslations } from "next-intl";
import Backbutton from "@/components/common/backbutton/backbutton";
import Image from "next/image";
import {
  useCreateRefillRequestMutation,
  type RefillRequest,
} from "@/store/Apis/refillTransferScheduleApi/refillTransferScheduleApi";
import useShowToast from "@/hooks/useShowToast";
import { useDateOfBirthValidation } from "@/hooks/useDateOfBirthValidation";
import { useAppSelector } from "@/store/hooks";
import {
  selectIsLoggedIn,
  selectUser,
} from "@/store/slices/userSlice/userSlice";
import { useGetProfileQuery } from "@/store/Apis/profileApi/profileApi";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
type MedicationInput = {
  id: number;
  name: string;
  rxNumber: string;
};

type FormValues = {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  dateOfBirth: Date | undefined; // Changed back to Date for the calendar
  pharmacyName: string;
  pharmacyPhone?: string;
  pharmacyAddress: string;
  pharmacyCity?: string; // Added for pharmacy city
  pharmacyState?: string; // Added for pharmacy state
  pharmacyZipCode?: string; // Added for pharmacy zip code
  deliveryAddress: string;
  aptUnit: string;
  city: string;
  state: string;
  zipCode: string;
  medications: MedicationInput[];
  refillAll: boolean;
  notes: string;
  consent: boolean;
};

// Parse date from "dd-mm-yyyy" or ISO format to Date object
const parseDateOfBirth = (dateStr: string | undefined): Date | undefined => {
  if (!dateStr) return undefined;

  try {
    // Try parsing as ISO date first
    const isoDate = new Date(dateStr);
    if (!isNaN(isoDate.getTime())) {
      return isoDate;
    }

    // Try parsing "dd-mm-yyyy" format
    if (dateStr.includes("-") && !dateStr.includes("T")) {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const [day, month, year] = parts;
        const date = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
        );
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }
  } catch {
    // Return undefined if parsing fails
  }

  return undefined;
};

function RefillOnline() {
  const t = useTranslations("refillOnline");
  const isLoggedIn = useAppSelector(selectIsLoggedIn);
  const currentUser = useAppSelector(selectUser);
  const { data: profile, refetch: refetchProfile } = useGetProfileQuery(
    undefined,
    {
      skip: !isLoggedIn, // Skip query if not logged in
    },
  );

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      firstName: "",
      lastName: "",
      phoneNumber: "",
      dateOfBirth: undefined,
      pharmacyName: "",
      pharmacyPhone: "",
      pharmacyAddress: "",
      pharmacyCity: "",
      pharmacyState: "",
      pharmacyZipCode: "",
      deliveryAddress: "",
      aptUnit: "",
      city: "",
      state: "",
      zipCode: "",
      medications: [{ id: 1, name: "", rxNumber: "" }],
      refillAll: false,
      notes: "",
      consent: false,
    },
  });
  const [createRefillRequest, { isLoading }] = useCreateRefillRequestMutation();
  const { showSuccess, showError } = useShowToast();
  const { getDateOfBirthError } = useDateOfBirthValidation();
  const { fields, append } = useFieldArray({
    control,
    name: "medications",
  });

  // Track previous user ID to detect user changes
  const [previousUserId, setPreviousUserId] = useState<string | null>(null);

  // Clear form and refetch profile when user changes
  useEffect(() => {
    const currentUserId = currentUser?._id || null;

    // If user ID changed, clear personal info immediately and refetch profile
    if (isLoggedIn && currentUserId && currentUserId !== previousUserId) {
      // Clear personal info immediately to avoid showing old data
      setValue("firstName", "");
      setValue("lastName", "");
      setValue("phoneNumber", "");
      setValue("dateOfBirth", undefined);
      // Update previous user ID
      setPreviousUserId(currentUserId);
      // Force refetch to get fresh data for the new user
      refetchProfile();
    } else if (!isLoggedIn) {
      // Reset previous user ID on logout
      setPreviousUserId(null);
      // Clear personal info if user logs out (for guests)
      setValue("firstName", "");
      setValue("lastName", "");
      setValue("phoneNumber", "");
      setValue("dateOfBirth", undefined);
    } else if (isLoggedIn && currentUserId && !previousUserId) {
      // First time user logs in, set previous user ID
      setPreviousUserId(currentUserId);
    }
  }, [isLoggedIn, currentUser?._id, previousUserId, refetchProfile, setValue]);

  // Pre-populate personal information if user is logged in
  useEffect(() => {
    if (isLoggedIn && profile?.data) {
      // Populate personal information fields from profile
      if (profile.data.first_name) {
        setValue("firstName", profile.data.first_name);
      }
      if (profile.data.last_name) {
        setValue("lastName", profile.data.last_name);
      }
      if (profile.data.phone) {
        setValue("phoneNumber", profile.data.phone);
      }

      // Parse and set date of birth
      const dob = parseDateOfBirth(profile.data.dateOfBirth);
      if (dob) {
        setValue("dateOfBirth", dob);
      }
    }
  }, [isLoggedIn, profile?.data, setValue]);

  const addMedication = () => {
    const newId =
      fields.length > 0 ? Math.max(...fields.map((m) => m.id)) + 1 : 1;
    append({ id: newId, name: "", rxNumber: "" });
  };

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    try {
      // Filter and validate medications
      const validMedications = data.medications.filter(
        (med) => med.name.trim() !== "" || med.rxNumber.trim() !== "",
      );

      // Ensure at least one medication is provided
      if (validMedications.length === 0) {
        showError({
          message: "Please add at least one medication to your refill request.",
        });
        return;
      }

      // Validate date of birth (must be at least 13 years old)
      if (data.dateOfBirth) {
        const dateError = getDateOfBirthError(data.dateOfBirth.toISOString());
        if (dateError) {
          showError({ message: dateError });
          return;
        }
      }

      // Format date of birth to YYYY-MM-DD
      const formattedDateOfBirth = data.dateOfBirth
        ? `${data.dateOfBirth.getFullYear()}-${String(
            data.dateOfBirth.getMonth() + 1,
          ).padStart(2, "0")}-${String(data.dateOfBirth.getDate()).padStart(
            2,
            "0",
          )}`
        : "";

      // Transform form data to API format
      const refillRequest: RefillRequest = {
        requiestType: "refill", // Note: keeping typo as per API requirement
        personalInfo: {
          first_name: data.firstName,
          last_name: data.lastName,
          phone: data.phoneNumber,
          dateOfBirth: formattedDateOfBirth,
        },
        pharmacyInfo: {
          name: data.pharmacyName,
          phone: data.pharmacyPhone || undefined,
          city: data.pharmacyCity || undefined,
          state: data.pharmacyState || undefined,
          zipCode: data.pharmacyZipCode || undefined,
        },
        deliveryInfo: {
          address: data.deliveryAddress,
          aptUnit: data.aptUnit || undefined,
          city: data.city,
          state: data.state,
          zipCode: data.zipCode,
        },
        medicationList: validMedications.map((med) => ({
          medicationName: med.name,
          rxNumber: med.rxNumber,
        })),
        additionalNotes: data.notes || undefined,
      };

      const response = await createRefillRequest(refillRequest).unwrap();

      if (response.success) {
        showSuccess({
          message: response.message || "Refill request submitted successfully!",
        });
        // Reset form to initial state
        reset({
          firstName: "",
          lastName: "",
          phoneNumber: "",
          dateOfBirth: undefined,
          pharmacyName: "",
          pharmacyPhone: "",
          pharmacyAddress: "",
          pharmacyCity: "",
          pharmacyState: "",
          pharmacyZipCode: "",
          deliveryAddress: "",
          aptUnit: "",
          city: "",
          state: "",
          zipCode: "",
          medications: [{ id: 1, name: "", rxNumber: "" }],
          refillAll: false,
          notes: "",
        });
      } else {
        showError({
          message:
            response.error ||
            response.message ||
            "Failed to submit refill request",
        });
      }
    } catch (error: unknown) {
      // Handle RTK Query error
      let errorMessage =
        "An error occurred while submitting the refill request";

      if (error && typeof error === "object") {
        if ("data" in error && error.data && typeof error.data === "object") {
          const data = error.data as { message?: string; error?: string };
          errorMessage = data.message || data.error || errorMessage;
        } else if ("message" in error && typeof error.message === "string") {
          errorMessage = error.message;
        }
      }

      showError({ message: errorMessage });
    }
  };

  return (
    <div className=" relative container mx-auto bg-white mb-6 mt-4 md:mt-0 ">
      <div className="max-w-3xl mx-auto">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-6 md:space-y-8 px-4"
        >
          <div className="flex  items-center justify-center mt-2 mb-4 lg:-mt-8 lg:mb-8 ">
            <Backbutton />
            <h2 className="text-2xl lg:text-3xl font-bold text-center text-peter font-inter mx-auto">
              {t("pageTitle")}
            </h2>
          </div>

          {/* Personal Information Section */}
          <div className="bg-white rounded-lg border p-6 shadow-sm">
            <h3 className="text-lg font-medium text-peter mb-4">
              {t("personalInformation.title")}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label
                  htmlFor="firstName"
                  className="text-sm font-medium text-gray-700"
                >
                  {t("personalInformation.firstName")} *
                </Label>
                <Input
                  type="text"
                  id="firstName"
                  {...register("firstName", {
                    required: t("personalInformation.firstNameRequired"),
                  })}
                  placeholder={t("personalInformation.firstNamePlaceholder")}
                  className={cn(
                    "w-full mt-1",
                    errors.firstName && "border-red-500",
                  )}
                />
                {errors.firstName && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.firstName.message}
                  </p>
                )}
              </div>
              <div>
                <Label
                  htmlFor="lastName"
                  className="text-sm font-medium text-gray-700"
                >
                  {t("personalInformation.lastName")} *
                </Label>
                <Input
                  type="text"
                  id="lastName"
                  {...register("lastName", {
                    required: t("personalInformation.lastNameRequired"),
                  })}
                  placeholder={t("personalInformation.lastNamePlaceholder")}
                  className={cn(
                    "w-full mt-1",
                    errors.lastName && "border-red-500",
                  )}
                />
                {errors.lastName && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.lastName.message}
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label
                  htmlFor="phoneNumber"
                  className="text-sm font-medium text-gray-700"
                >
                  {t("personalInformation.phoneNumber")} *
                </Label>
                <Controller
                  name="phoneNumber"
                  control={control}
                  rules={{
                    required: t("personalInformation.phoneNumberRequired"),
                    validate: (value) =>
                      !value
                        ? true
                        : isValidPhoneNumber(value) ||
                          t("personalInformation.phoneNumberInvalid") ||
                          "Please enter a valid phone number",
                  }}
                  render={({ field }) => (
                    <PhoneInput
                      id="phoneNumber"
                      defaultCountry="US"
                      international
                      placeholder={t(
                        "personalInformation.phoneNumberPlaceholder",
                      )}
                      value={field.value || undefined}
                      onChange={(val) => field.onChange(val ?? "")}
                      onBlur={field.onBlur}
                      className={cn(
                        "PhoneInput mt-1 flex h-9 w-full min-w-0 rounded-md border pl-2 pr-0 shadow-xs transition-[color,box-shadow] outline-none",
                        "bg-transparent [&_.PhoneInputCountry]:bg-transparent [&_.PhoneInputInput]:border-0 [&_.PhoneInputInput]:bg-transparent [&_.PhoneInputInput]:focus-visible:ring-0 [&_.PhoneInputInput]:outline-none",
                        "border-input focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
                        "text-sm",
                        errors.phoneNumber && "!border-red-500",
                      )}
                      // numberInputProps={{
                      //   className: cn(
                      //     "flex h-10 w-full min-w-0 flex-1 rounded-r-md border-0 bg-transparent px-3 py-1 text-sm outline-none placeholder:text-muted-foreground",
                      //     "focus-visible:ring-0 focus-visible:ring-offset-0"
                      //   ),
                      // }}
                      inputComponent={Input}
                    />
                  )}
                />
                {errors.phoneNumber && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.phoneNumber.message}
                  </p>
                )}
              </div>
              <div>
                <Label
                  htmlFor="dateOfBirth"
                  className="text-sm font-medium text-gray-700"
                >
                  {t("personalInformation.dateOfBirth")} *
                </Label>
                <Controller
                  control={control}
                  name="dateOfBirth"
                  rules={{
                    required: t("personalInformation.dateOfBirthRequired"),
                    validate: (value) => {
                      if (!value) return true;
                      return getDateOfBirthError(value.toISOString()) ?? true;
                    },
                  }}
                  render={({ field }) => (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          id="dateOfBirth"
                          variant={"outline"}
                          className={cn(
                            "w-full mt-1 justify-between font-normal",
                            !field.value && "text-muted-foreground",
                            errors.dateOfBirth && "border-red-500",
                          )}
                        >
                          {field.value ? (
                            // Format the date as MM/DD/YYYY
                            `${(field.value.getMonth() + 1)
                              .toString()
                              .padStart(2, "0")}/${field.value
                              .getDate()
                              .toString()
                              .padStart(2, "0")}/${field.value.getFullYear()}`
                          ) : (
                            <span>
                              {t("personalInformation.dateOfBirthPlaceholder")}
                            </span>
                          )}
                          <ChevronDownIcon className="h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => {
                            // Prevent future dates
                            if (date && date <= new Date()) {
                              field.onChange(date);
                              void trigger("dateOfBirth");
                            } else if (!date) {
                              field.onChange(date);
                              void trigger("dateOfBirth");
                            }
                          }}
                          captionLayout="dropdown"
                          fromYear={1900}
                          toYear={new Date().getFullYear()}
                          disabled={(date) => date > new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                />
                {errors.dateOfBirth && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.dateOfBirth.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Pharmacy Information Section */}
          <div className="bg-white rounded-lg border p-6 shadow-sm">
            <h3 className="text-lg font-medium text-peter mb-4">
              {t("pharmacyInformation.title")}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label
                  htmlFor="pharmacyName"
                  className="text-sm font-medium text-gray-700"
                >
                  {t("pharmacyInformation.pharmacyName")} *
                </Label>
                <Input
                  type="text"
                  id="pharmacyName"
                  {...register("pharmacyName", {
                    required: t("pharmacyInformation.pharmacyNameRequired"),
                  })}
                  placeholder={t("pharmacyInformation.pharmacyNamePlaceholder")}
                  className={cn(
                    "w-full mt-1",
                    errors.pharmacyName && "border-red-500",
                  )}
                />
                {errors.pharmacyName && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.pharmacyName.message}
                  </p>
                )}
              </div>
              <div>
                <Label
                  htmlFor="pharmacyPhone"
                  className="text-sm font-medium text-gray-700"
                >
                  {t("pharmacyInformation.pharmacyPhone")}
                </Label>
                <Controller
                  name="pharmacyPhone"
                  control={control}
                  rules={{
                    validate: (value) =>
                      !value || value.trim() === ""
                        ? true
                        : isValidPhoneNumber(value) ||
                          t("pharmacyInformation.pharmacyPhoneInvalid") ||
                          "Please enter a valid phone number",
                  }}
                  render={({ field }) => (
                    <PhoneInput
                      id="pharmacyPhone"
                      defaultCountry="US"
                      international
                      placeholder={t(
                        "pharmacyInformation.pharmacyPhonePlaceholder",
                      )}
                      value={field.value || undefined}
                      onChange={(val) => field.onChange(val ?? "")}
                      onBlur={field.onBlur}
                      className={cn(
                        "PhoneInput mt-1 flex h-9 w-full min-w-0 rounded-md border pl-2 pr-0 shadow-xs transition-[color,box-shadow] outline-none",
                        "bg-transparent [&_.PhoneInputCountry]:bg-transparent [&_.PhoneInputInput]:border-0 [&_.PhoneInputInput]:bg-transparent [&_.PhoneInputInput]:focus-visible:ring-0 [&_.PhoneInputInput]:outline-none",
                        "border-input focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
                        "text-sm",
                        errors.pharmacyPhone && "!border-red-500",
                      )}
                      // numberInputProps={{
                      //   className: cn(
                      //     "flex h-10 w-full min-w-0 flex-1 rounded-r-md border-0 bg-transparent px-3 py-1 text-sm outline-none placeholder:text-muted-foreground",
                      //     "focus-visible:ring-0 focus-visible:ring-offset-0"
                      //   ),
                      // }}
                      inputComponent={Input}
                    />
                  )}
                />
                {errors.pharmacyPhone && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.pharmacyPhone.message}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-2">
              <Label
                htmlFor="pharmacyAddress"
                className="text-sm font-medium text-gray-700"
              >
                {t("pharmacyInformation.pharmacyAddress")}
              </Label>
              <Input
                type="text"
                id="pharmacyAddress"
                {...register("pharmacyAddress")}
                placeholder={t(
                  "pharmacyInformation.pharmacyAddressPlaceholder",
                )}
                className="w-full mt-1"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div>
                <Label
                  htmlFor="pharmacyCity"
                  className="text-sm font-medium text-gray-700"
                >
                  {t("pharmacyInformation.city")}
                </Label>
                <Input
                  type="text"
                  id="pharmacyCity"
                  {...register("pharmacyCity")}
                  placeholder={t("pharmacyInformation.cityPlaceholder")}
                  className="w-full mt-1"
                />
              </div>
              <div>
                <Label
                  htmlFor="pharmacyState"
                  className="text-sm font-medium text-gray-700"
                >
                  {t("pharmacyInformation.state")}
                </Label>
                <Input
                  type="text"
                  id="pharmacyState"
                  {...register("pharmacyState")}
                  placeholder={t("pharmacyInformation.statePlaceholder")}
                  className="w-full mt-1"
                />
              </div>
              <div>
                <Label
                  htmlFor="pharmacyZipCode"
                  className="text-sm font-medium text-gray-700"
                >
                  {t("pharmacyInformation.zipCode")}
                </Label>
                <Input
                  type="text"
                  id="pharmacyZipCode"
                  {...register("pharmacyZipCode", {
                    pattern: {
                      value: /^\d{5}(-\d{4})?$/,
                      message: t("pharmacyInformation.zipCodeInvalid"),
                    },
                  })}
                  placeholder={t("pharmacyInformation.zipCodePlaceholder")}
                  className="w-full mt-1"
                />
              </div>
            </div>
          </div>

          {/* Delivery Details Section */}
          <div className="bg-white rounded-lg border p-6 shadow-sm">
            <h3 className="text-lg font-medium text-peter mb-4">
              {t("deliveryDetails.title")}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label
                  htmlFor="deliveryAddress"
                  className="text-sm font-medium text-gray-700"
                >
                  {t("deliveryDetails.deliveryAddress")} *
                </Label>
                <Input
                  type="text"
                  id="deliveryAddress"
                  {...register("deliveryAddress", {
                    required: t("deliveryDetails.deliveryAddressRequired"),
                  })}
                  placeholder={t("deliveryDetails.deliveryAddressPlaceholder")}
                  className={cn(
                    "w-full mt-1",
                    errors.deliveryAddress && "border-red-500",
                  )}
                />
                {errors.deliveryAddress && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.deliveryAddress.message}
                  </p>
                )}
              </div>
              <div>
                <Label
                  htmlFor="aptUnit"
                  className="text-sm font-medium text-gray-700"
                >
                  {t("deliveryDetails.aptUnit")}
                </Label>
                <Input
                  type="text"
                  id="aptUnit"
                  {...register("aptUnit")}
                  placeholder={t("deliveryDetails.aptUnitPlaceholder")}
                  className="w-full mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label
                  htmlFor="city"
                  className="text-sm font-medium text-gray-700"
                >
                  {t("deliveryDetails.city")}
                </Label>
                <Input
                  type="text"
                  id="city"
                  {...register("city", { required: false })}
                  placeholder={t("deliveryDetails.cityPlaceholder")}
                  className="w-full mt-1"
                />
              </div>
              <div>
                <Label
                  htmlFor="state"
                  className="text-sm font-medium text-gray-700"
                >
                  {t("deliveryDetails.state")}
                </Label>
                <Input
                  type="text"
                  id="state"
                  {...register("state", { required: false })}
                  placeholder={t("deliveryDetails.statePlaceholder")}
                  className="w-full mt-1"
                />
              </div>
              <div>
                <Label
                  htmlFor="zipCode"
                  className="text-sm font-medium text-gray-700"
                >
                  {t("deliveryDetails.zipCode")}
                </Label>
                <Input
                  type="text"
                  id="zipCode"
                  {...register("zipCode", { required: false })}
                  placeholder={t("deliveryDetails.zipCodePlaceholder")}
                  className="w-full mt-1"
                />
              </div>
            </div>
          </div>

          {/* Medication List Section */}
          <div className="bg-white rounded-lg border p-6 shadow-sm">
            <h3 className="text-lg font-medium text-peter ">
              {t("medicationList.title")}
            </h3>
            {/* <div className="mb-4 flex items-start gap-2 text-sm text-gray-600 italic">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mt-1 text-gray-400"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <p>Add the medication... right under &quot;Medication List&quot;</p>
          </div> */}
            <div className="mb-4 text-xs text-gray-600 italic">
              <p>{t("medicationList.instruction")}</p>
            </div>

            <div className="mb-4 flex items-center">
              <Controller
                control={control}
                name="refillAll"
                render={({ field }) => (
                  <Checkbox
                    id="refillAll"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <label htmlFor="refillAll" className="ml-2 text-sm text-gray-700">
                {t("medicationList.refillAll")}
              </label>
            </div>

            {fields.map((field, index) => (
              <div
                key={field.id}
                className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4"
              >
                <div>
                  <Label
                    htmlFor={`medications.${index}.name`}
                    className="text-sm font-medium text-gray-700"
                  >
                    {t("medicationList.medicationName")}
                  </Label>
                  <Input
                    type="text"
                    id={`medications.${index}.name`}
                    {...register(`medications.${index}.name` as const)}
                    placeholder={t("medicationList.medicationNamePlaceholder")}
                    className="w-full mt-1"
                  />
                </div>
                <div>
                  <Label
                    htmlFor={`medications.${index}.rxNumber`}
                    className="text-sm font-medium text-gray-700"
                  >
                    {t("medicationList.rxNumber")}
                  </Label>
                  <Input
                    type="text"
                    id={`medications.${index}.rxNumber`}
                    {...register(`medications.${index}.rxNumber` as const)}
                    placeholder={t("medicationList.rxNumberPlaceholder")}
                    className="w-full mt-1"
                  />
                </div>
              </div>
            ))}

            <Button
              type="button"
              onClick={addMedication}
              variant="outline"
              className="border-peter text-peter hover:bg-peter/10"
            >
              {t("medicationList.addAnother")}
            </Button>
          </div>

          {/* Additional Notes Section */}
          <div className="bg-white rounded-lg border p-6 shadow-sm">
            <Label
              htmlFor="notes"
              className="text-sm font-medium text-gray-700 block mb-2"
            >
              {t("additionalNotes.title")}
            </Label>
            <Textarea
              id="notes"
              {...register("notes")}
              placeholder={t("additionalNotes.placeholder")}
              className="w-full h-24"
            />
          </div>
          {/* Consent Section */}
          <div className="bg-[#f3ecf3] rounded-lg border border-[#d2b5d2] p-6">
            <div className="flex items-start ">
              <Controller
                control={control}
                name="consent"
                rules={{
                  required: t("consent.required"),
                }}
                render={({ field }) => (
                  <Checkbox
                    id="consent"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className={
                      errors.consent
                        ? "border-red-500 mt-0"
                        : "border-[#d2b5d2] mt-0"
                    }
                  />
                )}
              />
              <label htmlFor="consent" className="ml-2 text-xs text-gray-700 ">
                {t("consent.label")}{" "}
                <p className="text-xs text-gray-700 text-justify">
                  {t("consent.agreementText")}{" "}
                  <Link
                    href="/policies/terms-of-service"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-peter hover:underline"
                    onClick={(e: React.MouseEvent<HTMLAnchorElement>) =>
                      e.stopPropagation()
                    }
                  >
                    {t("consent.termsOfService")}
                  </Link>
                  {t("consent.and")}
                  <Link
                    href="/policies/privacy-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-peter hover:underline"
                    onClick={(e: React.MouseEvent<HTMLAnchorElement>) =>
                      e.stopPropagation()
                    }
                  >
                    {t("consent.privacyPolicy")}
                  </Link>
                  .
                </p>
              </label>
            </div>
            {errors.consent && (
              <p className="text-red-500 text-xs mt-1 ml-6">
                {errors.consent.message}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-peter hover:bg-peter-dark text-white py-3 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <p className="flex items-center justify-center gap-2">
                  {t("submitting")}
                  <Loader className="animate-spin size-4 text-white" />
                </p>
              </>
            ) : (
              t("submitButton")
            )}
          </Button>
        </form>
      </div>

      <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center pointer-events-none">
        <Image
          src="/watermark.webp"
          alt="Refill Online"
          width={1000}
          height={1000}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-contain opacity-30 w-full xl:w-[85%] 2xl:w-[95%] h-full"
        />
      </div>
    </div>
  );
}

export default RefillOnline;
