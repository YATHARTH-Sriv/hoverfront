import React from "react";
import { IBM_Plex_Mono, Host_Grotesk } from "next/font/google";

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: "500",
});

const grotesk = Host_Grotesk({
  subsets: ["latin"],
  weight: "400",
});

function Featurescard() {
  return <div className=" w-80 h-100 rounded-lg bg-[#2B6E9D]"></div>;
}

function Infocard() {
  return (
    <div className="w-full mt-38 flex justify-center  h-100 ">
      <div className=" w-[70%] h-100">
        <span className={`${ibmPlexMono.className} text-black uppercase text-[21px]`}>
          PICK YOUR PATH
        </span>
        <div className=" flex items-center justify-between mt-4">
          <Featurescard />
          <Featurescard />
          <Featurescard />
        </div>
      </div>
    </div>
  );
}

export default Infocard;
