"use client";
import React, { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DollarSign } from "lucide-react";
import { useGetPaymentQuery } from "@/store/Apis/paymentApi/paymentApi";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

// Format date for display
const formatDateDisplay = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "";
  try {
    return dayjs.utc(dateStr).format("MMM D, YYYY");
  } catch {
    return "";
  }
};

// Format amount as currency
const formatAmount = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined) return "$0.00";
  return `$${amount.toFixed(2)}`;
};

export default function RecentTransactions() {
  const { data: paymentData, isLoading } = useGetPaymentQuery({
    page: 1,
    limit: 10,
  });

  // Get latest 10 transactions, sorted by date descending
  const latestTransactions = useMemo(() => {
    if (!paymentData?.data?.result) return [];

    return [...paymentData.data.result]
      .sort((a, b) => {
        const dateA = a.transactionDate || a.createdAt || "";
        const dateB = b.transactionDate || b.createdAt || "";
        return dayjs(dateB).valueOf() - dayjs(dateA).valueOf();
      })
      .slice(0, 10);
  }, [paymentData]);

  return (
    <div className="w-full max-w-md">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">
        Recent Transactions
      </h1>

      <ScrollArea className="h-[600px] w-full rounded-lg border bg-white">
        <div className="p-2">
          {isLoading ? (
            <p className="text-gray-500 text-center py-8">
              Loading transactions...
            </p>
          ) : latestTransactions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No transactions</p>
          ) : (
            latestTransactions.map((transaction) => {
              // Get orderId as a string - handle both string and object types
              const orderId =
                transaction.transactionId ||
                (typeof transaction.prescriptionOrderId === "string"
                  ? transaction.prescriptionOrderId
                  : transaction.prescriptionOrderId?._id) ||
                transaction._id;
              const transactionDate =
                transaction.transactionDate || transaction.createdAt;

              return (
                <div
                  key={transaction._id}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
                >
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-purple-600" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900">
                      Prescription Payment
                    </h3>
                    <p className="text-sm text-gray-500">
                      Order {orderId.slice(0, 6)}****{orderId.slice(-6)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      {formatAmount(transaction.amount)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDateDisplay(transactionDate)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
