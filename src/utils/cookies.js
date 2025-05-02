const setAuthCookies = (res, accessToken, refreshToken) => {
  const isProduction = process.env.NODE_ENV === "production";
  const isLocalhost = process.env.NODE_ENV === "development";
  
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction, // true in production, false in development
    sameSite: isLocalhost ? "Lax" : "None", // Lax for localhost, None for production
    domain: isLocalhost ? undefined : ".yourdomain.com", // Set domain in production
    path: "/" // Set root path for accessToken
  };

  // Access token cookie
  res.cookie("accessToken", accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  // Refresh token cookie
  res.cookie("refreshToken", refreshToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/api/v1/refresh", // Specific path for refresh
  });

  return { accessToken, refreshToken };
};

const clearAuthCookies = (res) => {
  const isProduction = process.env.NODE_ENV === "production";
  
  const baseOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "None" : "Lax"
  };

  res.clearCookie("accessToken", {
    ...baseOptions,
    path: "/"
  });
  
  res.clearCookie("refreshToken", {
    ...baseOptions,
    path: "/api/v1/refresh"
  });
};