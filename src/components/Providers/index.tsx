"use client";
import type { PropsWithChildren } from "react";
import WagmiProvider from "./WagmiProvider";

const Providers = ({ children }: PropsWithChildren) => {
  return <WagmiProvider>{children}</WagmiProvider>;
};

export default Providers;
