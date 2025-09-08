import { Loader2 } from "lucide-react";

export function LoadingScreen() {
  return (
    <div className="flex justify-center items-center h-screen bg-gray-50">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-700 mb-2">
          Loading turbine images...
        </h2>
        <p className="text-gray-500">Please wait while we fetch your data</p>
      </div>
    </div>
  );
}
