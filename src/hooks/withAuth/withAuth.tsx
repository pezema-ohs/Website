"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAppSelector } from "@/store/hooks";
import {
  selectUser,
  selectIsLoggedIn,
  //   selectUserRole,
} from "@/store/slices/userSlice/userSlice";
import { getCookie } from "@/lib/cookies";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import Image from "next/image";
import Loader from "@/components/common/loader/Loader";

interface WithAuthOptions {
  allowedRoles?: string | string[];
  redirectTo?: string;
  requireAuth?: boolean;
  protectedRoute?: string; // Route pattern to protect (e.g., "/dashboard/:path*")
}

/**
 * Higher Order Component for route protection based on authentication and role
 *
 * @param {React.ComponentType} WrappedComponent - The component to protect
 * @param {Object} options - Configuration options
 * @param {string|string[]} options.allowedRoles - Role(s) allowed to access the page
 * @param {string} options.redirectTo - Path to redirect if unauthorized (default: '/auth/login')
 * @param {boolean} options.requireAuth - Whether authentication is required (default: true)
 * @returns {React.ComponentType} Protected component
 */
function withAuth<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: WithAuthOptions = {},
) {
  const {
    allowedRoles = [],
    redirectTo = "/auth/login",
    requireAuth = true,
    // protectedRoute,
  } = options;

  function AuthenticatedComponent(props: P) {
    const router = useRouter();
    const pathname = usePathname();
    const [isChecking, setIsChecking] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [showUnauthorizedModal, setShowUnauthorizedModal] = useState(false);

    // Get auth state from Redux
    const isLoggedIn = useAppSelector(selectIsLoggedIn);
    const user = useAppSelector(selectUser);

    useEffect(() => {
      const checkAuth = () => {
        // Check if we're on client side
        if (typeof window === "undefined") {
          setIsChecking(false);
          return;
        }

        // Check authentication using cookies
        const token = getCookie("token");
        const hasToken = !!token;

        // console.log("withAuth: Checking authentication", {
        //   hasToken,
        //   isLoggedIn,
        //   requireAuth,
        //   pathname,
        //   protectedRoute,
        // });

        // Step 1: Check if authentication is required (requireAuth: true)
        if (requireAuth) {
          // If authentication is required but user is not authenticated
          if (!hasToken && !isLoggedIn) {
            // console.log("withAuth: Not authenticated, redirecting to login");
            // Include current path as redirect parameter
            const loginUrl = `${redirectTo}?redirect=${encodeURIComponent(
              pathname,
            )}`;
            router.push(loginUrl);
            setIsChecking(false);
            setIsAuthorized(false);
            return;
          }

          // If we have a token but context says not logged in, still allow (token is primary)
          // The context might not be updated yet, but token exists
          if (hasToken && !isLoggedIn) {
            // console.log(
            // "withAuth: Token exists but context not updated, continuing to role check"
            // );
          }
        } else {
          // If authentication is not required, allow access
          setIsAuthorized(true);
          setIsChecking(false);
          return;
        }

        // Step 2: Check role authorization (allowedRoles: "user")
        // If no roles specified, just check authentication
        if (
          !allowedRoles ||
          (Array.isArray(allowedRoles) && allowedRoles.length === 0)
        ) {
          setIsAuthorized(true);
          setIsChecking(false);
          return;
        }

        // Check role authorization
        const currentRole = user?.role || "";
        const rolesArray = Array.isArray(allowedRoles)
          ? allowedRoles
          : [allowedRoles];

        const hasAccess = rolesArray.includes(currentRole);

        if (!hasAccess) {
          // console.log(
          //   "withAuth: Access denied. Required roles:",
          //   rolesArray,
          //   "Current role:",
          //   currentRole
          // );
          // Show unauthorized modal instead of redirecting
          setShowUnauthorizedModal(true);
          setIsChecking(false);
          setIsAuthorized(false);
          return;
        }

        // User passed both checks: authenticated (requireAuth: true) and has correct role (allowedRoles: "user")
        setIsAuthorized(true);
        setIsChecking(false);
      };

      checkAuth();
    }, [router, pathname, isLoggedIn, user?.role]);

    const handleGoBack = () => {
      router.back();
      setShowUnauthorizedModal(false);
    };

    // Show loading state while checking
    if (isChecking) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="flex flex-col items-center gap-4">
            <Loader />
          </div>
        </div>
      );
    }

    // If not authorized, show modal
    if (!isAuthorized) {
      return (
        <>
          <Dialog
            open={showUnauthorizedModal}
            onOpenChange={setShowUnauthorizedModal}
          >
            <DialogContent className="sm:max-w-md" showCloseButton={false}>
              <DialogHeader>
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-red-600" />
                  </div>
                  <DialogTitle className="text-xl font-bold text-gray-900">
                    Access Denied
                  </DialogTitle>
                  <DialogDescription className="text-center text-gray-600">
                    You are not authorized to access this page.
                  </DialogDescription>
                </div>
              </DialogHeader>
              <div className="flex justify-center mt-4">
                <Button
                  onClick={handleGoBack}
                  className="bg-peter hover:bg-peter/80 text-white"
                >
                  Go Back
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          {/* Render empty div to prevent layout shift */}
          <div className="min-h-screen flex items-center justify-center">
            <div className="w-1/2 h-1/2 flex items-center justify-center">
              <Image
                src="/guard.webp"
                alt="Unauthorized"
                width={500}
                height={500}
                quality={100}
                className="w-1/2 h-1/2 object-contain"
              />
            </div>
          </div>
        </>
      );
    }

    // Render the wrapped component
    return <WrappedComponent {...props} />;
  }

  // Set display name for debugging
  AuthenticatedComponent.displayName = `withAuth(${
    WrappedComponent.displayName || WrappedComponent.name || "Component"
  })`;

  return AuthenticatedComponent;
}

export default withAuth;
