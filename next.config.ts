import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: {
    appIsrStatus: false, // Keeps the "N" button hidden
  },
  // Whitelist your local network IPs (I kept the old one in there just in case you switch back)
  allowedDevOrigins: [
    "192.168.31.88", 
    "http://192.168.31.88:3000",
    "10.115.26.169", 
    "http://10.115.26.169:3000"
  ],
};

export default nextConfig;