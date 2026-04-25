"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDownIcon, Loader } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

import React, { useState, useEffect } from "react";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { useTranslations } from "next-intl";
import CalendarModal from "./calendarModal";
import Backbutton from "@/components/common/backbutton/backbutton";
import Image from "next/image";
import {
  useCreateScheduleRequestMutation,
  type ScheduleRequest,
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

type FormValues = {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  dateOfBirth: Date | undefined; // Renamed from date to dateOfBirth

  // Pharmacy details
  pharmacyName: string;
  pharmacyPhone: string;
  pharmacyAddress: string;
  pharmacyCity: string;
  pharmacyState: string;
  pharmacyZipCode: string;

  // Service type
  serviceCategory: string;
  serviceType: string;
  otherService: string;
  otherVaccination: string;
  otherHealthScreening: string;

  // Appointment details
  appointmentDate: string;
  appointmentTime: string;
  appointmentAllTimes: string[];

  // Additional info
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

function ScheduleOnline() {
  const t = useTranslations("scheduleOnline");
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
    trigger,
    formState: { errors },
    watch,
    setValue,
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
      serviceCategory: "",
      serviceType: "",
      otherService: "",
      otherVaccination: "",
      otherHealthScreening: "",
      appointmentDate: "",
      appointmentTime: "",
      appointmentAllTimes: [],
      notes: "",
      consent: false,
    },
  });

  const [createScheduleRequest, { isLoading }] =
    useCreateScheduleRequestMutation();
  const { showSuccess, showError } = useShowToast();
  const { getDateOfBirthError } = useDateOfBirthValidation();

  // State for calendar modal
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);

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

  // Watch the service category to update available options in second dropdown
  const selectedCategory = watch("serviceCategory");
  const selectedServiceType = watch("serviceType");
  const [selectedAppointmentDates, setSelectedAppointmentDates] = useState<
    Array<{ date: string; times: string[] }>
  >([]);

  // Reset service type and other service when category changes
  React.useEffect(() => {
    if (selectedCategory) {
      setValue("serviceType", "");
      setValue("otherService", "");
      setValue("otherVaccination", "");
      setValue("otherHealthScreening", "");
    }
  }, [selectedCategory, setValue]);

  // Reset otherVaccination when serviceType changes
  React.useEffect(() => {
    if (selectedServiceType && selectedServiceType !== "vaccinations_others") {
      setValue("otherVaccination", "");
    }
  }, [selectedServiceType, setValue]);

  // Reset otherHealthScreening when serviceType changes
  React.useEffect(() => {
    if (
      selectedServiceType &&
      selectedServiceType !== "health_screenings_others"
    ) {
      setValue("otherHealthScreening", "");
    }
  }, [selectedServiceType, setValue]);

  const handleSelectDateTime = (
    selectedDates: Array<{ date: string; times: string[] }>,
  ) => {
    setValue(
      "appointmentDates" as keyof FormValues,
      selectedDates as unknown as FormValues[keyof FormValues],
    );
    setSelectedAppointmentDates(selectedDates);
    setIsCalendarModalOpen(false);
  };

  const handleRemoveDate = (dateToRemove: string) => {
    const updatedDates = selectedAppointmentDates.filter(
      (item) => item.date !== dateToRemove,
    );
    setValue(
      "appointmentDates" as keyof FormValues,
      updatedDates as unknown as FormValues[keyof FormValues],
    );
    setSelectedAppointmentDates(updatedDates);
  };

  const handleRemoveTime = (date: string, timeToRemove: string) => {
    const updatedDates = selectedAppointmentDates
      .map((item) => {
        if (item.date === date) {
          const updatedTimes = item.times.filter(
            (time) => time !== timeToRemove,
          );
          if (updatedTimes.length === 0) {
            return null; // Remove date if no times left
          }
          return { ...item, times: updatedTimes };
        }
        return item;
      })
      .filter(
        (item): item is { date: string; times: string[] } => item !== null,
      );
    setValue(
      "appointmentDates" as keyof FormValues,
      updatedDates as unknown as FormValues[keyof FormValues],
    );
    setSelectedAppointmentDates(updatedDates);
  };

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    try {
      // Validate consent
      if (!data.consent) {
        showError({
          message: t("consent.required") || "You must consent to proceed",
        });
        return;
      }

      // Validate appointment dates
      if (!selectedAppointmentDates || selectedAppointmentDates.length === 0) {
        showError({
          message:
            t("appointment.required") ||
            "Please select at least one appointment date and time",
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

      // Determine serviceType and serviceTypeChild based on conditions
      let serviceType: string;
      let serviceTypeChild: string | undefined;

      if (data.serviceCategory === "service_type_others") {
        // If category is "others", use otherService as serviceType (not serviceTypeChild)
        serviceType = data.otherService || "";
      } else {
        // Otherwise, use serviceCategory as serviceType
        serviceType = data.serviceCategory;

        // serviceTypeChild is only set for vaccinations or health_screenings
        if (
          data.serviceCategory === "vaccinations" ||
          data.serviceCategory === "health_screenings"
        ) {
          if (
            data.serviceType === "vaccinations_others" ||
            data.serviceType === "health_screenings_others"
          ) {
            // If serviceType is "others", use the custom input as serviceTypeChild
            if (data.serviceCategory === "vaccinations") {
              serviceTypeChild = data.otherVaccination || undefined;
            } else {
              serviceTypeChild = data.otherHealthScreening || undefined;
            }
          } else if (data.serviceType) {
            // If serviceType is NOT "others", use serviceType value as serviceTypeChild
            serviceTypeChild = data.serviceType;
          }
        }
      }

      // Format appointment dates to MM/DD/YYYY format
      const formattedAppointmentDates = selectedAppointmentDates.map(
        (appointment) => ({
          date: (() => {
            // Try to parse the date string
            let dateObj: Date;

            // First, try parsing as Date
            dateObj = new Date(appointment.date);

            // If that fails, try to parse from common formats
            if (isNaN(dateObj.getTime())) {
              // Try parsing formats like "Monday, April 24, 2025" or "April 24, 2025"
              const parsed = Date.parse(appointment.date);
              if (!isNaN(parsed)) {
                dateObj = new Date(parsed);
              } else {
                // If still can't parse, check if it's already in MM/DD/YYYY format
                const mmddyyyyMatch = appointment.date.match(
                  /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
                );
                if (mmddyyyyMatch) {
                  // Already in MM/DD/YYYY format, return as is
                  return appointment.date;
                }
                // Last resort: return as is if we can't parse
                return appointment.date;
              }
            }

            // Format to MM/DD/YYYY
            const month = String(dateObj.getMonth() + 1).padStart(2, "0");
            const day = String(dateObj.getDate()).padStart(2, "0");
            const year = dateObj.getFullYear();
            return `${month}/${day}/${year}`;
          })(),
          time: appointment.times,
        }),
      );

      // Transform form data to API format
      const scheduleRequest: ScheduleRequest = {
        requiestType: "schedule", // Note: keeping typo as per API requirement
        personalInfo: {
          first_name: data.firstName,
          last_name: data.lastName,
          phone: data.phoneNumber,
          dateOfBirth: formattedDateOfBirth,
        },
        pharmacyInfo: {
          name: data.pharmacyName || undefined,
          phone: data.pharmacyPhone || undefined,
          city: data.pharmacyCity || undefined,
          state: data.pharmacyState || undefined,
          zipCode: data.pharmacyZipCode || undefined,
          address: data.pharmacyAddress || undefined,
          availableDateTime: formattedAppointmentDates,
          serviceType: serviceType,
          serviceTypeChild: serviceTypeChild,
        },
        additionalNotes: data.notes || undefined,
      };

      const response = await createScheduleRequest(scheduleRequest).unwrap();

      if (response.success) {
        showSuccess({
          message:
            response.message || "Schedule request submitted successfully!",
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
          serviceCategory: "",
          serviceType: "",
          otherService: "",
          otherVaccination: "",
          otherHealthScreening: "",
          appointmentDate: "",
          appointmentTime: "",
          appointmentAllTimes: [],
          notes: "",
          consent: false,
        });
        setSelectedAppointmentDates([]);
      } else {
        showError({
          message:
            response.error ||
            response.message ||
            "Failed to submit schedule request",
        });
      }
    } catch (error: unknown) {
      // Handle RTK Query error
      let errorMessage =
        "An error occurred while submitting the schedule request";

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
    <div className=" relative container mx-auto bg-white  mb-6">
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

          {/* Profile Info Section */}
          <div className="bg-white rounded-lg border p-6 shadow-sm">
            <h3 className="text-lg font-medium text-peter mb-4">
              {t("profileInfo.title")}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label
                  htmlFor="firstName"
                  className="text-sm font-medium text-gray-700"
                >
                  {t("profileInfo.firstName")} *
                </Label>
                <Input
                  type="text"
                  id="firstName"
                  {...register("firstName", {
                    required: t("profileInfo.firstNameRequired"),
                  })}
                  placeholder={t("profileInfo.firstNamePlaceholder")}
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
                  {t("profileInfo.lastName")} *
                </Label>
                <Input
                  type="text"
                  id="lastName"
                  {...register("lastName", {
                    required: t("profileInfo.lastNameRequired"),
                  })}
                  placeholder={t("profileInfo.lastNamePlaceholder")}
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
                  {t("profileInfo.phoneNumber")} *
                </Label>
                <Controller
                  name="phoneNumber"
                  control={control}
                  rules={{
                    required: t("profileInfo.phoneNumberRequired"),
                    validate: (value) =>
                      !value
                        ? true
                        : isValidPhoneNumber(value) ||
                          t("profileInfo.phoneNumberInvalid") ||
                          "Please enter a valid phone number",
                  }}
                  render={({ field }) => (
                    <PhoneInput
                      id="phoneNumber"
                      defaultCountry="US"
                      international
                      placeholder={t("profileInfo.phoneNumberPlaceholder")}
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
                  {t("profileInfo.dateOfBirth")} *
                </Label>
                <Controller
                  control={control}
                  name="dateOfBirth"
                  rules={{
                    required: t("profileInfo.dateOfBirthRequired"),
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
                              {t("profileInfo.dateOfBirthPlaceholder")}
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
            <div className="mb-4">
              <Label
                htmlFor="pharmacyAddress"
                className="text-sm font-medium text-gray-700"
              >
                {t("pharmacyInformation.pharmacyAddress")} *
              </Label>
              <Input
                type="text"
                id="pharmacyAddress"
                {...register("pharmacyAddress", {
                  required: t("pharmacyInformation.pharmacyAddressRequired"),
                })}
                placeholder={t(
                  "pharmacyInformation.pharmacyAddressPlaceholder",
                )}
                className={cn(
                  "w-full mt-1",
                  errors.pharmacyAddress && "border-red-500",
                )}
              />
              {errors.pharmacyAddress && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.pharmacyAddress.message}
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
                  {...register("pharmacyCity", {
                    required: false,
                  })}
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
                  {...register("pharmacyState", {
                    required: false,
                  })}
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
                    required: false,
                  })}
                  placeholder={t("pharmacyInformation.zipCodePlaceholder")}
                  className="w-full mt-1"
                />
              </div>
            </div>

            {/* Service Category Dropdown */}
            <div className="mb-4">
              <Label
                htmlFor="serviceCategory"
                className="text-sm font-medium text-gray-700"
              >
                {t("services.serviceCategory.label")}
              </Label>
              <Controller
                control={control}
                name="serviceCategory"
                rules={{ required: t("services.serviceCategory.required") }}
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <SelectTrigger
                      className={cn(
                        "w-full mt-1 h-10 text-[14px]",
                        errors.serviceCategory && "border-red-500",
                      )}
                    >
                      <SelectValue
                        placeholder={t("services.serviceCategory.placeholder")}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vaccinations">
                        {t("services.serviceCategory.vaccinations")}
                      </SelectItem>
                      <SelectItem value="health_screenings">
                        {t("services.serviceCategory.health_screenings")}
                      </SelectItem>
                      <SelectItem value="service_type_others">
                        {t("services.serviceCategory.others")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.serviceCategory && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.serviceCategory.message}
                </p>
              )}
            </div>

            {/* Specific Service Dropdown - Conditionally shown based on category */}
            {selectedCategory && selectedCategory !== "service_type_others" && (
              <div className="mb-4">
                <Label
                  htmlFor="serviceType"
                  className="text-sm font-medium text-gray-700"
                >
                  {selectedCategory === "vaccinations"
                    ? t("services.serviceType.vaccinations.label")
                    : t("services.serviceType.health_screenings.label")}
                </Label>
                <Controller
                  control={control}
                  name="serviceType"
                  rules={{
                    required:
                      selectedCategory === "vaccinations"
                        ? t("services.serviceType.vaccinations.required")
                        : t("services.serviceType.health_screenings.required"),
                  }}
                  render={({ field }) => (
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <SelectTrigger
                        className={cn(
                          "w-full mt-1 h-10 text-[14px]",
                          errors.serviceType && "border-red-500",
                        )}
                      >
                        <SelectValue
                          placeholder={
                            selectedCategory === "vaccinations"
                              ? t(
                                  "services.serviceType.vaccinations.placeholder",
                                )
                              : t(
                                  "services.serviceType.health_screenings.placeholder",
                                )
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedCategory === "vaccinations" ? (
                          <>
                            <SelectItem value="flu">
                              {t("services.serviceType.vaccinations.flu")}
                            </SelectItem>
                            <SelectItem value="covid">
                              {t("services.serviceType.vaccinations.covid")}
                            </SelectItem>
                            <SelectItem value="shingles">
                              {t("services.serviceType.vaccinations.shingles")}
                            </SelectItem>
                            <SelectItem value="vaccinations_others">
                              {t("services.serviceType.vaccinations.others")}
                            </SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value="blood_pressure">
                              {t(
                                "services.serviceType.health_screenings.blood_pressure",
                              )}
                            </SelectItem>
                            <SelectItem value="cholesteric">
                              {t(
                                "services.serviceType.health_screenings.cholesteric",
                              )}
                            </SelectItem>
                            <SelectItem value="diabetes">
                              {t(
                                "services.serviceType.health_screenings.diabetes",
                              )}
                            </SelectItem>
                            <SelectItem value="health_screenings_others">
                              {t(
                                "services.serviceType.health_screenings.others",
                              )}
                            </SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.serviceType && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.serviceType.message}
                  </p>
                )}
              </div>
            )}

            {/* Other Vaccination Input - Shown when "vaccinations_others" is selected */}
            {selectedCategory === "vaccinations" &&
              selectedServiceType === "vaccinations_others" && (
                <div className="mb-4">
                  <Label
                    htmlFor="otherVaccination"
                    className="text-sm font-medium text-gray-700"
                  >
                    {t("services.serviceType.otherVaccination.label")} *
                  </Label>
                  <Input
                    type="text"
                    id="otherVaccination"
                    {...register("otherVaccination", {
                      required: t(
                        "services.serviceType.otherVaccination.required",
                      ),
                    })}
                    placeholder={t(
                      "services.serviceType.otherVaccination.placeholder",
                    )}
                    className={cn(
                      "w-full mt-1",
                      errors.otherVaccination && "border-red-500",
                    )}
                  />
                  {errors.otherVaccination && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.otherVaccination.message}
                    </p>
                  )}
                </div>
              )}

            {/* Other Health Screening Input - Shown when "health_screenings_others" is selected */}
            {selectedCategory === "health_screenings" &&
              selectedServiceType === "health_screenings_others" && (
                <div className="mb-4">
                  <Label
                    htmlFor="otherHealthScreening"
                    className="text-sm font-medium text-gray-700"
                  >
                    {t("services.serviceType.otherHealthScreening.label")} *
                  </Label>
                  <Input
                    type="text"
                    id="otherHealthScreening"
                    {...register("otherHealthScreening", {
                      required: t(
                        "services.serviceType.otherHealthScreening.required",
                      ),
                    })}
                    placeholder={t(
                      "services.serviceType.otherHealthScreening.placeholder",
                    )}
                    className={cn(
                      "w-full mt-1",
                      errors.otherHealthScreening && "border-red-500",
                    )}
                  />
                  {errors.otherHealthScreening && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.otherHealthScreening.message}
                    </p>
                  )}
                </div>
              )}

            {/* Other Service Input - Shown when "Others" is selected */}
            {selectedCategory === "service_type_others" && (
              <div className="mb-4">
                <Label
                  htmlFor="otherService"
                  className="text-sm font-medium text-gray-700"
                >
                  {t("services.serviceType.otherService.label")} *
                </Label>
                <Input
                  type="text"
                  id="otherService"
                  {...register("otherService", {
                    required: t("services.serviceType.otherService.required"),
                  })}
                  placeholder={t(
                    "services.serviceType.otherService.placeholder",
                  )}
                  className={cn(
                    "w-full mt-1",
                    errors.otherService && "border-red-500",
                  )}
                />
                {errors.otherService && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.otherService.message}
                  </p>
                )}
              </div>
            )}

            {/* Calendar  */}
            <div className="mb-4">
              <Label
                htmlFor="appointmentDateTime"
                className="text-sm font-medium text-gray-700"
              >
                {t("appointment.label")}
              </Label>
              <Button
                type="button"
                variant={"outline"}
                onClick={() => setIsCalendarModalOpen(true)}
                className={cn(
                  "w-full mt-1 justify-between font-normal text-left",
                  (!selectedAppointmentDates ||
                    selectedAppointmentDates.length === 0) &&
                    "text-muted-foreground",
                )}
              >
                {selectedAppointmentDates &&
                selectedAppointmentDates.length > 0 ? (
                  <span className="text-sm font-medium text-gray-700">
                    {selectedAppointmentDates.length}{" "}
                    {selectedAppointmentDates.length === 1
                      ? t("appointment.datesSelected")
                      : t("appointment.datesSelectedPlural")}{" "}
                  </span>
                ) : (
                  <span>{t("appointment.placeholder")}</span>
                )}
                <ChevronDownIcon className="h-4 w-4 opacity-50" />
              </Button>

              {/* Display selected dates and times */}
              {selectedAppointmentDates &&
                Array.isArray(selectedAppointmentDates) &&
                selectedAppointmentDates.length > 0 && (
                  <div className="mt-3 space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    {selectedAppointmentDates.map(
                      (
                        appointment: { date: string; times: string[] },
                        index: number,
                      ) => (
                        <div
                          key={index}
                          className="bg-white p-3 rounded-md border border-gray-300"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h4 className="text-sm font-semibold text-gray-900 mb-1">
                                {appointment.date}
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {appointment.times.map(
                                  (time: string, timeIndex: number) => (
                                    <div
                                      key={timeIndex}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-peter/10 text-peter rounded-md text-xs"
                                    >
                                      <span>{time}</span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleRemoveTime(
                                            appointment.date,
                                            time,
                                          )
                                        }
                                        className="ml-1 hover:text-red-600 transition-colors"
                                        aria-label={`Remove ${time}`}
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ),
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveDate(appointment.date)}
                              className="ml-2 text-red-600 hover:text-red-800 text-sm font-medium"
                              aria-label={`Remove ${appointment.date}`}
                            >
                              {t("appointment.remove")}
                            </button>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                )}

              {(!selectedAppointmentDates ||
                selectedAppointmentDates.length === 0) && (
                <p className="text-red-500 text-xs mt-1">
                  {t("appointment.required")}
                </p>
              )}
            </div>

            <Label
              htmlFor="notes"
              className="text-sm font-medium text-gray-700 block mb-2"
            >
              {t("additionalNotes.label")}
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
            <div className="flex items-start">
              <Controller
                control={control}
                name="consent"
                rules={{ required: t("consent.required") }}
                render={({ field }) => (
                  <Checkbox
                    id="consent"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className={
                      errors.consent
                        ? "border-red-500 mt-0.5"
                        : "border-[#d2b5d2] mt-0.5"
                    }
                  />
                )}
              />
              <label htmlFor="consent" className="ml-2 text-xs text-gray-700">
                {t("consent.label")}{" "}
                <p className="text-xs text-gray-700">
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
          alt="Schedule Online"
          width={1000}
          height={1000}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-contain opacity-30 w-full xl:w-[85%] 2xl:w-[95%] h-full"
        />
      </div>

      {/* Calendar Modal */}
      <CalendarModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        onSelectDateTime={handleSelectDateTime}
        initialSelectedDates={selectedAppointmentDates || []}
      />
    </div>
  );
}

export default ScheduleOnline;
