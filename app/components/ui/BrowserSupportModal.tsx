import React from 'react';

interface BrowserSupportModalProps {
  onClose: () => void;
}

export function BrowserSupportModal({ onClose }: BrowserSupportModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
      <div className="bg-gray-900 text-white p-8 rounded-lg max-w-md mx-4 text-center">
        <div className="mb-6">
          <div className="flex justify-center space-x-4 mb-6">
            {/* Chrome Icon */}
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 via-yellow-500 to-green-500 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-blue-500 border-2 border-white"></div>
            </div>
            
            {/* Edge Icon */}
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-green-400 flex items-center justify-center">
              <div className="w-6 h-6 bg-white rounded-sm transform rotate-45"></div>
            </div>
            
            {/* Brave Icon */}
            <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center">
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
              </div>
            </div>
          </div>
        </div>
        
        <h2 className="text-xl font-semibold mb-4">
          Bolt works best in supported browsers
        </h2>
        
        <p className="text-gray-300 mb-4">
          Your current browser doesn't support key technologies that Bolt relies on. 
          For the best experience, consider using{' '}
          <span className="text-blue-400 font-medium">Chrome</span>,{' '}
          <span className="text-green-400 font-medium">Edge</span>, or another{' '}
          <span className="text-purple-400 font-medium">Chromium-based browser</span>.
        </p>
        
        <button
          onClick={onClose}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
        >
          Continue anyway (limited)
        </button>
      </div>
    </div>
  );
}
