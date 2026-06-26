"use client"

import { useState, useEffect } from "react";
// import { useRouter } from "next/router";
import Link from "next/link";

type Disaster = {
  type: string;
  id: string;
};

type DisasterIconsProps = {
  type?: string;
  count?: number;
  disasters?: Disaster[];
};

// const router = useRouter();

const AlertIcon = ({ className = "" }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
    <line x1="12" y1="9" x2="12" y2="13"></line>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>
);

const EarthquakeIcon = ({ className = "" }: { className?: string }) => (
  <svg
    version="1.0"
    xmlns="http://www.w3.org/2000/svg"
    width="40"
    height="40"
    viewBox="0 0 400 400"
    preserveAspectRatio="xMidYMid meet"
    className={className}
  >
    <g transform="translate(0,268) scale(0.05,-0.05)" fill="currentColor" stroke="none">
      <path d="M3172 4463 c-6 -9 -126 -69 -266 -133 -454 -206 -493 -224 -696 -322 -110 -53 -207 -100 -215 -104 -21 -10 -19 91 2 132 10 19 24 75 31 126 l14 92 -153 25 c-84 13 -156 20 -161 16 -10 -10 -57 -283 -79 -451 -9 -73 -24 -110 -46 -118 -18 -6 -69 -27 -113 -47 -44 -20 -103 -46 -132 -56 -53 -20 -136 -267 -111 -331 16 -43 133 -56 185 -22 58 37 80 8 50 -66 -11 -30 -30 -108 -41 -174 -10 -66 -56 -331 -100 -590 -45 -258 -91 -535 -104 -614 l-22 -145 -289 -5 -289 -6 -1 -200 -2 -200 749 -5 749 -5 144 139 144 140 -122 185 c-67 102 -144 218 -171 256 l-49 70 76 67 c42 37 276 235 521 439 390 326 441 376 420 406 -14 18 -83 108 -155 198 -229 291 -210 254 -145 287 31 16 175 120 320 231 374 285 378 224 7 -102 l-129 -113 237 -251 c130 -139 244 -252 253 -252 42 0 -7 -56 -403 -460 l-420 -429 145 -150 c80 -83 215 -224 302 -313 l156 -162 -21 -78 c-12 -43 -22 -85 -22 -93 0 -8 351 -15 780 -15 l780 0 0 211 0 212 -265 -4 -265 -5 5 48 c5 46 52 317 115 668 16 88 35 212 42 275 14 122 32 140 73 75 18 -30 46 -40 107 -40 l83 0 21 155 20 155 -113 109 c-62 61 -356 344 -653 630 -297 286 -588 568 -646 626 -114 112 -116 114 -132 88z m175 -420 c71 -73 199 -196 285 -273 269 -241 808 -775 808 -800 0 -13 -23 -41 -50 -62 -115 -86 -189 -240 -218 -448 -4 -27 -27 -171 -51 -320 -70 -428 -69 -415 -37 -465 103 -158 69 -174 -347 -175 -290 0 -263 -13 -459 219 -69 81 -165 185 -212 229 -122 115 -117 128 160 393 497 475 546 620 290 857 -174 161 -217 257 -155 344 23 32 37 58 31 58 -6 0 6 29 28 65 56 92 51 178 -13 242 -75 76 -134 68 -312 -41 -41 -25 -89 -46 -107 -46 -45 0 -204 -120 -304 -228 -140 -152 -137 -234 14 -465 119 -182 130 -154 -143 -387 -715 -611 -721 -621 -573 -907 35 -68 81 -148 103 -179 86 -123 -28 -162 -440 -150 -334 10 -325 5 -257 140 41 82 73 226 143 636 49 292 103 600 118 686 34 191 16 345 -47 396 -75 61 -14 173 123 224 19 7 55 53 79 103 49 101 76 110 151 51 28 -22 67 -40 88 -40 55 0 319 106 298 119 -16 11 432 224 696 333 138 56 157 49 310 -109z" />
    </g>
  </svg>
);

const WaveIcon = ({ className = "" }: { className?: string }) => (
  <svg
    version="1.0"
    xmlns="http://www.w3.org/2000/svg"
    width="40"
    height="40"
    viewBox="0 0 400 400"
    preserveAspectRatio="xMidYMid meet"
    className={className}
  >
    <g transform="translate(0,318) scale(0.05,-0.05)" fill="currentColor" stroke="none">
      <path d="M2544 5499 c-749 -58 -1128 -289 -771 -470 115 -58 156 -54 98 10 -237 261 1450 410 2095 185 141 -50 213 -130 164 -184 -81 -89 81 -49 185 46 174 158 -74 307 -655 394 -192 28 -856 40 -1116 19z" />
      <path d="M1470 5421 c-254 -65 -629 -244 -669 -319 -81 -151 118 -324 445 -386 148 -28 168 -56 66 -92 -390 -142 -76 -413 593 -513 117 -17 224 -36 239 -41 78 -27 847 -47 1216 -30 474 20 777 64 1055 151 36 11 45 6 45 -26 0 -332 -2452 -584 -2891 -296 -72 47 -63 115 26 192 l74 66 -65 -13 c-183 -37 -464 -224 -464 -310 0 -133 355 -283 675 -284 92 0 95 -3 64 -61 -25 -47 46 -129 128 -150 43 -11 49 -22 40 -67 -17 -88 202 -242 345 -242 15 0 28 -7 28 -16 0 -55 739 -147 1115 -140 449 9 464 -55 25 -105 -557 -65 -1180 19 -1154 155 17 88 -177 20 -199 -70 -17 -66 88 -159 198 -177 84 -14 98 -48 30 -77 -104 -46 -45 -153 121 -217 459 -178 1655 14 1294 207 -63 34 -55 65 21 81 153 32 249 124 209 199 -19 35 -12 44 59 72 147 59 119 167 -71 273 -124 69 -139 69 -88 -1 23 -31 36 -70 30 -88 -63 -163 -1106 -119 -1623 68 -101 36 -89 83 18 68 461 -66 1303 -8 1735 121 321 95 418 226 230 309 -114 51 -113 63 11 92 403 96 624 393 339 456 -89 20 -90 44 -2 89 189 96 162 280 -48 333 -71 18 -64 68 9 68 259 0 581 227 530 374 -34 96 -449 300 -726 356 -81 17 -82 -29 -2 -51 588 -161 241 -453 -680 -573 -1452 -189 -3228 235 -2322 555 141 50 134 96 -9 60z m440 -845 c562 -93 1881 -63 2505 56 59 11 65 8 65 -36 0 -407 -2436 -493 -2900 -103 -88 74 -85 156 5 138 36 -7 182 -32 325 -55z m2287 -924 c37 -194 -1262 -359 -1857 -237 -298 61 -236 95 160 88 454 -8 1221 74 1550 165 117 33 138 31 147 -16z m-1107 -1082 c220 0 456 7 525 16 114 15 125 13 125 -21 0 -168 -1105 -186 -1208 -19 -32 51 17 76 96 47 38 -14 216 -22 462 -23z" />
      <path d="M2780 2224 c0 -10 37 -83 82 -161 166 -285 139 -453 -131 -834 -90 -126 237 116 452 334 137 140 252 325 299 480 53 173 45 199 -56 181 -105 -19 -502 -18 -581 3 -39 10 -65 9 -65 -3z" />
    </g>
  </svg>
);

export default function DisasterIcons({
  type,
  count,
  disasters: externalDisasters,
}: DisasterIconsProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [internalDisasters, setInternalDisasters] = useState<Disaster[]>([]);

  useEffect(() => {
    setTimeout(() => {
      setIsLoaded(true);
      if (externalDisasters) {
        setInternalDisasters(externalDisasters);
      } else if (type && count) {
        const converted = Array.from({ length: count }, (_, i) => ({
          type,
          id: `legacy-${i}`,
        }));
        setInternalDisasters(converted);
      }
    }, 500);
  }, [type, count, externalDisasters]);

  const disasterCounts = internalDisasters.reduce((acc, disaster) => {
    acc[disaster.type] = (acc[disaster.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const disasterTypes = Object.keys(disasterCounts);
  const primaryDisasterType = disasterTypes.includes("earthquake") ? "earthquake" : 
                            disasterTypes.includes("cyclone") ? "cyclone" : null;

  return (
    <div
      className="fixed top-22 right-12 z-50 flex flex-col items-end"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative group">
        {!isHovered && isLoaded && internalDisasters.length > 0 && (
          <div className="absolute top-6 right-16 px-3 py-1 bg-gray-800 text-white text-sm rounded-lg shadow-lg whitespace-nowrap">
            {primaryDisasterType === "earthquake" 
              ? `Earthquake ${disasterCounts["earthquake"] || 0}` 
              : primaryDisasterType === "cyclone" 
                ? `Cyclone ${disasterCounts["cyclone"] || 0}`
                : `${internalDisasters.length} Alert${internalDisasters.length !== 1 ? 's' : ''}`
            }
          </div>
        )}

        <Link
          href="#"
          className="relative flex h-13 w-13 items-center justify-center rounded-full 
                     bg-red-600 shadow-xl hover:bg-red-700 transition-all focus:ring-2 
                     focus:ring-red-900"
          aria-label={`${internalDisasters.length} alerts - Click for details`}
        >
          <span className="absolute inset-0 animate-ripple rounded-full border-2 border-white opacity-70"></span>
          <span className="absolute inset-0 animate-ripple2 rounded-full border-2 border-white opacity-40"></span>

          {!isLoaded ? (
            <span className="text-white text-sm">...</span>
          ) : (
            <div className="relative h-6 w-6 text-white">
              {/* Default alert icon */}
              <AlertIcon className={`absolute transition-opacity duration-300 ${isHovered && primaryDisasterType ? 'opacity-0' : 'opacity-100'}`} />
              
              {/* Earthquake icon - shown on hover if earthquake exists */}
              {primaryDisasterType === "earthquake" && (
                <EarthquakeIcon className={`absolute transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`} />
              )}
              
              {/* Cyclone icon - shown on hover if cyclone exists */}
              {primaryDisasterType === "cyclone" && (
                <WaveIcon className={`absolute transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`} />
              )}
            </div>
          )}

          {internalDisasters.length > 0 && isLoaded && (
            <span className="absolute top-0 right-0 h-5 w-5 text-xs bg-white text-red-600 font-bold 
                           rounded-full flex items-center justify-center border-2 border-white shadow-lg">
              {internalDisasters.length}
            </span>
          )}
        </Link>
      </div>

      {isHovered && isLoaded && internalDisasters.length > 0 && (
        <div className="mt-2 w-64 bg-white rounded-lg shadow-xl overflow-hidden">
          <div className="py-1">
            <div className="px-4 py-2 bg-gray-100 text-gray-700 font-semibold border-b">
              Active Alerts ({internalDisasters.length})
            </div>

            {internalDisasters.map((disaster, index) => (
              <Link
                key={disaster.id}
                href={`/${disaster.type === "earthquake" ? "earthquakePage" : "cyclonePage"}`}
                className={`flex items-center px-4 py-3 hover:bg-red-50 transition-colors ${
                  index !== internalDisasters.length - 1 ? 'border-b' : ''
                }`}
              >
                <div className="flex-shrink-0">
                  {disaster.type === "earthquake" ? (
                    <EarthquakeIcon className="h-5 w-5 text-red-600" />
                  ) : (
                    <WaveIcon className="h-5 w-5 text-blue-600" />
                  )}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900 capitalize">
                    {disaster.type} alert #{index + 1}
                  </p>
                  <p className="text-xs text-gray-500">Click for details</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}