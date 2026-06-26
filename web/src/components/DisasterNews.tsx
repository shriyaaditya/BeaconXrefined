'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AlertCircle, Wind, Map } from 'lucide-react';
import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api';
import ErrorBoundary from './ErrorBoundary';
import { AnimatePresence, motion } from 'framer-motion';

interface NewsItem {
  id: string;
  title: string;
  description: string;
  source: string;
  url: string;
  publishedAt: string;
  category: string;
}

interface AirQualityData {
  aqi: number;
  category: string;
  pollutants: {
    pm25: number;
    pm10: number;
    o3: number;
    no2: number;
  };
  location: string;
  timestamp: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

interface HotspotCity {
  name: string;
  country: string;
  coordinates: { lat: number; lng: number };
}

interface MapPoint {
  id: string;
  location: string;
  coordinates: { lat: number; lng: number };
  aqi: number;
  category: string;
}

const mapContainerStyle = {
  width: '100%',
  height: '400px'
};

const defaultCenter = {
  lat: 51.5074,
  lng: -0.1278
};

const NewsDashboard = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoadingNews, setIsLoadingNews] = useState<boolean>(true);
  const [newsError, setNewsError] = useState<string | null>(null);
  
  const [airQuality, setAirQuality] = useState<AirQualityData | null>(null);
  const [isLoadingAQ, setIsLoadingAQ] = useState<boolean>(true);
  const [aqError, setAQError] = useState<string | null>(null);
  
  const [location, setLocation] = useState<string>('Delhi');
  const [debouncedLocation, setDebouncedLocation] = useState<string>(location);
  const [userLocation, setUserLocation] = useState<string | null>(null);
  const [showMap, setShowMap] = useState<boolean>(true);
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  
  
  const prevAqi = useRef<number | null>(null);
  const aqIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const newsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  
  const { isLoaded: mapsLoaded, loadError: mapLoadError } = useJsApiLoader({
    id: 'env-dashboard-map',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    version: "weekly",
    libraries: ["places", "visualization"]
  });

  const hotspotCities: HotspotCity[] = [
    { name: 'Delhi', country: 'India', coordinates: { lat: 28.7041, lng: 77.1025 } },
    { name: 'London', country: 'UK', coordinates: { lat: 51.5074, lng: -0.1278 } },
    { name: 'Beijing', country: 'China', coordinates: { lat: 39.9042, lng: 116.4074 } },
    { name: 'New York', country: 'USA', coordinates: { lat: 40.7128, lng: -74.0060 } },
    { name: 'Los Angeles', country: 'USA', coordinates: { lat: 34.0522, lng: -118.2437 } },
    { name: 'Mexico City', country: 'Mexico', coordinates: { lat: 19.4326, lng: -99.1332 } },
    { name: 'Cairo', country: 'Egypt', coordinates: { lat: 30.0444, lng: 31.2357 } },
    { name: 'Lahore', country: 'Pakistan', coordinates: { lat: 31.5204, lng: 74.3587 } },
    { name: 'Jakarta', country: 'Indonesia', coordinates: { lat: -6.2088, lng: 106.8456 } },
    { name: 'Paris', country: 'France', coordinates: { lat: 48.8566, lng: 2.3522 } },
  ];

  const getAQICategory = useCallback((aqi: number): string => {
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Moderate';
    if (aqi <= 150) return 'Unhealthy for Sensitive';
    if (aqi <= 200) return 'Unhealthy';
    if (aqi <= 300) return 'Very Unhealthy';
    return 'Hazardous';
  }, []);

  const calculateUSAQI = useCallback((pm25: number): number => {
    const breakpoints = [
      [0.0, 12.0, 0, 50],
      [12.1, 35.4, 51, 100],
      [35.5, 55.4, 101, 150],
      [55.5, 150.4, 151, 200],
      [150.5, 250.4, 201, 300],
      [250.5, 500.4, 301, 500],
    ];

    for (const [clow, chigh, ilow, ihigh] of breakpoints) {
      if (pm25 >= clow && pm25 <= chigh) {
        return Math.round(((ihigh - ilow) / (chigh - clow)) * (pm25 - clow) + ilow);
      }
    }
    return 500;
  }, []);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const response = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
            );
            const data = await response.json();
            const userLocationName = data.city || data.locality || 'Your Location';
            setUserLocation(userLocationName);
            setLocation(userLocationName);
          } catch (error) {
            console.error("Error getting location name:", error);
          }
        },
        (error) => {
          console.error("Error getting user location:", error);
        }
      );
    }
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedLocation(location);
    }, 1500);

    return () => {
      clearTimeout(handler);
    };
  }, [location]);

  const fetchAirQuality = useCallback(async () => {
    if (!debouncedLocation?.trim()) return;
    
    setIsLoadingAQ(true);
    try {
      const geocodeResponse = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(debouncedLocation)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
      );
      
      const geocodeData = await geocodeResponse.json();
      
      if (!geocodeData.results || geocodeData.results.length === 0) {
        throw new Error('Location not found');
      }
      
      const locationCoords = geocodeData.results[0].geometry.location;
      setMapCenter(locationCoords);

      const apiKey = process.env.NEXT_PUBLIC_WAQI_API_KEY || 'demo';
      const response = await fetch(
        `https://api.waqi.info/feed/geo:${locationCoords.lat};${locationCoords.lng}/?token=${apiKey}`
      );
      const data = await response.json();
      
      if (data.status !== 'ok') throw new Error('Invalid location or API error');
      
      const pm25 = data.data.iaqi.pm25?.v || 0;
      const aqi = calculateUSAQI(pm25);

      const newAQData: AirQualityData = {
        aqi,
        category: getAQICategory(aqi),
        pollutants: {
          pm25: pm25,
          pm10: data.data.iaqi.pm10?.v || 0,
          o3: data.data.iaqi.o3?.v || 0,
          no2: data.data.iaqi.no2?.v || 0,
        },
        location: debouncedLocation,
        timestamp: new Date().toISOString(),
        coordinates: locationCoords
      };

      setAirQuality(prev => {
        prevAqi.current = prev?.aqi || null;
        return newAQData;
      });

      setAQError(null);
    } catch (error) {
      console.error("Air quality fetch error:", error);
      setAQError('Failed to fetch air quality data. Please try a different location.');
    } finally {
      setIsLoadingAQ(false);
    }
  }, [debouncedLocation, calculateUSAQI, getAQICategory]);

  const fetchNews = useCallback(async () => {
    if (!debouncedLocation) return;
    
    setIsLoadingNews(true);
    try {      
      const keywordQuery = airQuality?.aqi && airQuality.aqi > 150
        ? `("air quality" OR pollution OR smog)`
        : null;

      const queryParams = [
        keywordQuery,
        debouncedLocation
      ].filter(Boolean).join(' AND ');

      const apiUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(queryParams)}&mode=artlist&format=json&maxrecords=5&sort=datedesc&timespan=1d&sourcelang=english`;

      const response = await fetch(apiUrl);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`GDELT API error: ${data}`);
      }

      type Article = {
        url?: string;
        title?: string;
        domain?: string;
        sourcecountry?: string;
        webUrl?: string;
        seendate?: string;
        webPublicationDate?: string;
      };
    
      
      const articles = Array.isArray(data.articles) ? data.articles : Array.isArray(data.results) ? data.results : [];
  
      const transformedNews = articles.map((article: Article) => ({
        id: article.url || Math.random().toString(36).substring(2, 9),
        title: article.title || 'No title available',
        description: article.domain 
          ? `From ${article.domain}${article.sourcecountry ? ` (${article.sourcecountry})` : ''}`
          : 'No source information',
        source: article.domain || 'Unknown source',
        url: article.url || article.webUrl || '#',
        publishedAt: article.seendate || article.webPublicationDate || new Date().toISOString(),
        category: 'general',
      }));
  
      const airQualityNews: NewsItem = {
        id: `aq-${Date.now()}`,
        title: `${debouncedLocation} Air Quality - ${new Date().toLocaleTimeString()}`,
        description: airQuality 
          ? `Current AQI: ${airQuality.aqi} (${airQuality.category})`
          : 'Monitoring air quality...',
        source: 'Air Quality Monitor',
        url: '#',
        publishedAt: new Date().toISOString(),
        category: 'environment'
      };
  
      setNews([airQualityNews, ...transformedNews]);
      setNewsError(null);
    } catch (error) {
      console.error("GDELT fetch error:", error);
      setNewsError(
        error instanceof Error ? error.message : 'Failed to load news from GDELT'
      );
    } finally {
      setIsLoadingNews(false);
    }
  }, [debouncedLocation, airQuality]);

  useEffect(() => {
    fetchAirQuality();
    aqIntervalRef.current = setInterval(fetchAirQuality, 300000);
  
    return () => {
      if (aqIntervalRef.current) {
        clearInterval(aqIntervalRef.current);
      }
    };
  }, [fetchAirQuality]);

  useEffect(() => {
    fetchNews();
    newsIntervalRef.current = setInterval(fetchNews, 1800000);

    return () => {
      if (newsIntervalRef.current) {
        clearInterval(newsIntervalRef.current);
      }
    };
  }, [fetchNews]);

  useEffect(() => {
    if (mapRef.current && airQuality?.coordinates) {
      mapRef.current.panTo(airQuality.coordinates);
    }
  }, [airQuality?.coordinates]);

  const getAQIColor = (aqi: number): string => {
    if (aqi <= 50) return 'bg-green-100 text-green-800';
    if (aqi <= 100) return 'bg-yellow-100 text-yellow-800';
    if (aqi <= 150) return 'bg-orange-100 text-orange-800';
    if (aqi <= 200) return 'bg-red-100 text-red-800';
    if (aqi <= 300) return 'bg-purple-100 text-purple-800';
    return 'bg-rose-100 text-rose-800';
  };
  
  const getHealthRecommendation = useCallback((aqi: number): string => {
    if (aqi <= 50) return 'Good air quality - safe for outdoor activities';
    if (aqi <= 100) return 'Moderate air quality - acceptable for most people, but sensitive individuals should consider reducing prolonged outdoor exertion';
    if (aqi <= 150) return 'Unhealthy for sensitive groups - People with respiratory or heart disease, the elderly and children should limit prolonged outdoor exertion';
    if (aqi <= 200) return 'Unhealthy - Everyone may begin to experience health effects; sensitive groups should avoid outdoor exertion';
    if (aqi <= 300) return 'Very Unhealthy - Health alert: everyone may experience more serious health effects. Avoid outdoor activities';
    return 'Hazardous - Health warnings of emergency conditions. Everyone should avoid all outdoor activities';
  },[]);

  const formatTime = (isoString: string): string => {
    return new Date(isoString).toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  const handleHotspotSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedCity = hotspotCities.find(city => city.name === e.target.value);
    if (selectedCity) {
      setLocation(selectedCity.name);
      setMapCenter(selectedCity.coordinates);
    }
  };

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const generateMapPoints = useCallback(() => {
    if (!airQuality?.coordinates) return [];

    const { lat, lng } = airQuality.coordinates;
    
    return Array.from({ length: 5 }, (_, i) => {
      const pointlat = lat + (Math.random() * 0.02 - 0.01);
      const pointlng = lng + (Math.random() * 0.02 - 0.01);
      const aqi = Math.max(0, Math.min(500, airQuality.aqi + (Math.random() * 20 - 10)));
      
      return {
        id: `point-${i}`,
        location: `Area ${i+1}`,
        coordinates: { lat: pointlat, lng: pointlng },
        aqi,
        category: getAQICategory(aqi)
      };
    });
  }, [airQuality, getAQICategory]);

  const mapPoints = useMemo(() => generateMapPoints(), [generateMapPoints]);

  const memoizedHealthRecommendation = useMemo(
    () => airQuality ? getHealthRecommendation(airQuality.aqi) : '',
    [airQuality, getHealthRecommendation]
  );


  return (
    <div className="flex flex-col gap-6 p-4 bg-gray-950 text-gray-200 md:p-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <h1 className="text-2xl text-emerald-400 font-bold">Environmental Dashboard</h1>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Enter location"
              className="p-2 border border-gray-700 rounded bg-gray-800 text-gray-200 w-48 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            {userLocation && (
              <button 
                onClick={() => setLocation(userLocation)}
                className="text-sm text-emerald-400 hover:text-emerald-300 hover:underline"
              >
                Use my location
              </button>
            )}
          </div>
          
          <select 
            onChange={handleHotspotSelect}
            className="p-2 border border-gray-700 rounded bg-gray-800 text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            value=""
          >
            <option value="" disabled>Pollution Hotspots</option>
            {hotspotCities.map(city => (
              <option key={`${city.name}-${city.country}`} value={city.name}>
                {city.name}, {city.country}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="border border-gray-800 rounded-lg overflow-hidden shadow-lg bg-gray-900">
        <div className="bg-gray-800 text-emerald-400 px-6 py-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Wind className="h-5 w-5 text-emerald-500" /> 
            Live Air Quality - {debouncedLocation}
            {airQuality && (
              <span className="ml-2 text-sm text-emerald-300">
                Updated {formatTime(airQuality.timestamp)}
              </span>
            )}
          </h2>
        </div>
        <div className="p-6">
          {isLoadingAQ ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
          ) : aqError ? (
            <div className="flex items-center justify-center p-6 text-red-400">
              <AlertCircle className="mr-2 h-5 w-5" /> {aqError}
            </div>
          ) : airQuality ? (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center">
                  <div className={`text-4xl font-bold px-4 py-2 rounded-lg ${getAQIColor(airQuality.aqi)}`}>
                    {airQuality.aqi}
                    {prevAqi.current !== null && (
                      <span className="ml-2 text-lg">
                        {airQuality.aqi > prevAqi.current ? '↑' : 
                         airQuality.aqi < prevAqi.current ? '↓' : '→'}
                      </span>
                    )}
                  </div>
                  <div className="ml-4">
                    <div className="text-xl font-medium text-gray-100">{airQuality.category}</div>
                    <div className="text-sm text-gray-400">
                      {airQuality.location}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                  {Object.entries(airQuality.pollutants).map(([key, value]) => (
                    <div key={key} className="flex items-center">
                      <div className={`w-3 h-3 rounded-full mr-2 ${
                        key === 'pm25' ? 'bg-blue-500' :
                        key === 'pm10' ? 'bg-green-500' :
                        key === 'o3' ? 'bg-yellow-500' : 'bg-red-500'
                      }`}></div>
                      <span className="text-sm text-gray-300">
                        {key.toUpperCase()}: {value} µg/m³
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg">
                <h3 className="font-medium mb-2 text-emerald-400">Health Guidance</h3>
                <p className="text-gray-300">{memoizedHealthRecommendation}</p>
              </div>
              
              <div className="p-4 border border-gray-700 rounded-lg">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-medium text-emerald-400">AQI Map for {airQuality.location}</h3>
                  <button 
                    onClick={() => setShowMap(!showMap)} 
                    className="text-emerald-400 text-sm hover:text-emerald-300 hover:underline flex items-center gap-1"
                  >
                    <Map className="h-4 w-4" /> 
                    {showMap ? 'Hide Map' : 'Show Map'}
                  </button>
                </div>
                
                {showMap && (
                <ErrorBoundary fallback={<div className="text-red-400 p-4">Map failed to load</div>}>
             
                    {mapsLoaded ? (
                      <GoogleMap
                        mapContainerStyle={mapContainerStyle}
                        center={mapCenter}
                        zoom={12}
                        onLoad={onMapLoad}
                        options={{
                          streetViewControl: false,
                          mapTypeControl: false,
                          fullscreenControl: false,
                          gestureHandling: 'cooperative',
                        }}
                      >
                        {airQuality.coordinates && (
                          <Marker
                            position={airQuality.coordinates}
                            icon={{
                              path: google.maps.SymbolPath.CIRCLE,
                              scale: 10,
                              fillColor: getMarkerColor(airQuality.aqi),
                              fillOpacity: 1,
                              strokeWeight: 2,
                              strokeColor: '#ffffff'
                            }}
                            onClick={() => {
                              setSelectedPoint({
                                id: 'main',
                                location: airQuality.location,
                                coordinates: airQuality.coordinates,
                                aqi: airQuality.aqi,
                                category: airQuality.category
                              });
                            }}
                          />
                        )}

                        {mapPoints.map((point) => (
                          <Marker 
                            key={point.id} 
                            position={point.coordinates} 
                            icon={{
                              path: google.maps.SymbolPath.CIRCLE,
                              scale: 8,
                              fillColor: getMarkerColor(point.aqi),
                              fillOpacity: 1,
                              strokeWeight: 2,
                              strokeColor: '#ffffff'
                            }}
                            onClick={() => setSelectedPoint(point)}
                          />
                        ))}

                        {selectedPoint && (
                          <InfoWindow
                            position={selectedPoint.coordinates}
                            onCloseClick={() => setSelectedPoint(null)}
                          >
                            <div className="p-2 bg-gray-800 text-gray-200">
                              <h4 className="font-bold">{selectedPoint.location}</h4>
                              <div className={`px-2 py-1 rounded ${getAQIColor(selectedPoint.aqi)}`}>
                                AQI: {selectedPoint.aqi} ({selectedPoint.category})
                              </div>
                            </div>
                          </InfoWindow>
                        )}
                      </GoogleMap>
                    ) : (
                      <div className="text-center p-4 text-gray-400">
                        {mapLoadError ? 'Failed to load map' : 'Loading map...'}
                      </div>
                    )}
                      </ErrorBoundary>
                      )}
                    </div>
                  </div>
            ) : (
            <div className="text-center p-6 text-gray-400">No air quality data</div>
          )}
        </div>
      </div>

<motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="border border-gray-800 rounded-xl overflow-hidden shadow-lg bg-gray-900 hover:shadow-xl transition-shadow"
      >
        <div className="bg-gray-800 px-6 py-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-emerald-400">
            <AlertCircle className="h-5 w-5 text-emerald-500" />
            Latest News for {debouncedLocation}
          </h2>
        </div>
        <div className="p-6">
          {isLoadingNews ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
          ) : newsError ? (
            <div className="flex items-center justify-center p-6 text-red-400">
              <AlertCircle className="mr-2 h-5 w-5" /> {newsError}
            </div>
          ) : news.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {news.slice(0,10).map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3 }}
                    whileHover={{ y: -5 }}
                  >
                    <a
                      href={item.url === "#" ? undefined : item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`block h-full border border-gray-700 rounded-xl p-4 ${
                        item.url === "#" ? "cursor-default" : "hover:bg-gray-800"
                      } transition-all bg-gray-900`}
                    >
                      <div className="flex flex-col h-full">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-3">
                            <h3 className="font-medium text-lg line-clamp-2 text-gray-100">
                              {item.title}
                            </h3>
                            {item.id.startsWith("aq") && (
                              <span className="px-2 py-1 bg-red-900 text-red-200 text-xs rounded-full whitespace-nowrap">
                                LIVE UPDATE
                              </span>
                            )}
                          </div>
                          <p className="text-gray-400 mb-4 line-clamp-3">
                            {item.description}
                          </p>
                        </div>
                        <div className="flex justify-between items-center mt-auto">
                          <span className="text-sm text-gray-500 truncate max-w-[120px]">
                            {item.source}
                          </span>
                          <div className="text-xs text-gray-500 whitespace-nowrap">
                            {formatTime(item.publishedAt)}
                          </div>
                        </div>
                      </div>
                    </a>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="text-center p-6 text-gray-400">
              No news available
            </div>
          )}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="text-center text-sm text-gray-500 mt-4"
      >
        Data sources: WAQI for air quality, GDELT for news. Refresh rate: AQI -
        5 minutes, News - 30 minutes.
      </motion.div>
    </div>
  );
};

function getMarkerColor(aqi: number): string {
  if (aqi <= 50) return '#10B981';
  if (aqi <= 100) return '#F59E0B';
  if (aqi <= 150) return '#F97316';
  if (aqi <= 200) return '#EF4444';
  if (aqi <= 300) return '#8B5CF6';
  return '#F43F5E';
}

export default NewsDashboard;