import { useLocation } from "wouter";
import { useTheme } from "@mui/material/styles";

export const NotFound = () => {
    const [location, setLocation] = useLocation();
    const theme = useTheme();

    const handleGoHome = () => setLocation("/");
    const handleGoBack = () => window.history.back();

    const isDark = theme.palette.mode === 'dark';

    return (
        <div className={`w-screen h-screen flex flex-col items-center justify-center ${
            isDark 
                ? 'bg-gradient-to-br from-gray-900 to-gray-800' 
                : 'bg-gradient-to-br from-gray-50 to-gray-100'
        }`}>
            <div className="flex flex-col items-center gap-6 px-4">
                <div className="text-8xl font-extrabold bg-gradient-to-r from-blue-600 via-blue-400 to-blue-300 bg-clip-text text-transparent select-none drop-shadow-lg">
                    404
                </div>
                <div className={`text-2xl md:text-3xl font-semibold text-center ${
                    isDark ? 'text-white' : 'text-gray-900'
                }`}>
                    Page Not Found
                </div>
                <div className={`text-base md:text-lg text-center max-w-md ${
                    isDark ? 'text-gray-300' : 'text-gray-600'
                }`}>
                    The page you are looking for does not exist:
                </div>
                <div className={`rounded px-3 py-2 font-mono text-sm break-all shadow-inner ${
                    isDark 
                        ? 'bg-gray-800 text-gray-200' 
                        : 'bg-gray-100 text-gray-700'
                }`}>
                    {location}
                </div>
                <div className="flex gap-4 mt-4">
                    <button
                        onClick={handleGoBack}
                        className={`px-6 py-2 rounded-lg border font-medium shadow transition ${
                            isDark
                                ? 'border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700'
                                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        Go Back
                    </button>
                    <button
                        onClick={handleGoHome}
                        className="px-6 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-400 text-white font-semibold shadow hover:from-blue-700 hover:to-blue-500 transition"
                    >
                        Go Home
                    </button>
                </div>
            </div>
        </div>
    );
};
