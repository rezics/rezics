import {Typography} from '@mui/material';

export function CustomSidebar({
  section,
  setSection,
}: {
  section: string;
  setSection: (section: string) => void;
}) {
  return (
    <div className="w-80 bg-white/90 backdrop-blur-sm border-r border-rose-200 min-h-screen shadow-sm">
      <div className="p-8">
        <div className="mb-12">
          <Typography variant="h4" className="font-bold text-gray-900 mb-3">
            Settings
          </Typography>
          <div className="w-16 h-1 bg-gradient-to-r from-rose-400 to-pink-500 rounded-full" />
        </div>

        <nav className="space-y-3">
          {[
            {id: 'Profile', label: 'Profile Settings', icon: '👤'},
            {id: 'Security', label: 'Security & Privacy', icon: '🔒'},
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setSection(item.id as any)}
              className={`w-full text-left px-6 py-4 rounded-xl transition-all duration-300 group
                                ${
                                  section === item.id
                                    ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-500/25 transform scale-[1.02]'
                                    : 'hover:bg-rose-50 text-gray-700 hover:shadow-md hover:scale-[1.01]'
                                }`}
            >
              <div className="flex items-center space-x-3">
                <span className="text-lg">{item.icon}</span>
                <div>
                  <div
                    className={`font-semibold ${
                      section === item.id ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {item.label}
                  </div>
                  <div
                    className={`text-sm ${
                      section === item.id ? 'text-rose-100' : 'text-gray-500'
                    }`}
                  >
                    {item.id === 'Profile'
                      ? 'Manage your personal information'
                      : 'Passwords and security keys'}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
