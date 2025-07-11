import React, { useState, useEffect } from 'react';
import { PluginApp } from '../PluginApp';
import { ExtendedPlugin } from '../types';

interface PluginManagerUIProps {
  pluginApp: PluginApp;
}

interface PluginCardProps {
  plugin: ExtendedPlugin;
  onToggle: (pluginId: string, enabled: boolean) => void;
  onUninstall: (pluginId: string) => void;
}

const PluginCard: React.FC<PluginCardProps> = ({ plugin, onToggle, onUninstall }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="plugin-card" style={{
      border: '1px solid #ddd',
      borderRadius: '8px',
      padding: '16px',
      margin: '8px 0',
      backgroundColor: plugin.enabled ? '#f0f8ff' : '#f5f5f5'
    }}>
      <div className="plugin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0' }}>{plugin.name}</h3>
          <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>v{plugin.version}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => onToggle(plugin.id, !plugin.enabled)}
            style={{
              padding: '4px 12px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: plugin.enabled ? '#dc3545' : '#28a745',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            {plugin.enabled ? 'Disable' : 'Enable'}
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              padding: '4px 8px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              backgroundColor: 'white',
              cursor: 'pointer'
            }}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="plugin-details" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #eee' }}>
          <p style={{ margin: '0 0 8px 0' }}><strong>Description:</strong> {plugin.description || 'No description'}</p>
          <p style={{ margin: '0 0 8px 0' }}><strong>Author:</strong> {plugin.author || 'Unknown'}</p>
          <p style={{ margin: '0 0 8px 0' }}><strong>Type:</strong> {plugin.type}</p>
          {plugin.dependencies && plugin.dependencies.length > 0 && (
            <p style={{ margin: '0 0 8px 0' }}>
              <strong>Dependencies:</strong> {plugin.dependencies.join(', ')}
            </p>
          )}
          <button
            onClick={() => onUninstall(plugin.id)}
            style={{
              padding: '4px 12px',
              borderRadius: '4px',
              border: '1px solid #dc3545',
              backgroundColor: 'white',
              color: '#dc3545',
              cursor: 'pointer',
              marginTop: '8px'
            }}
          >
            Uninstall
          </button>
        </div>
      )}
    </div>
  );
};

export const PluginManagerUI: React.FC<PluginManagerUIProps> = ({ pluginApp }) => {
  const [plugins, setPlugins] = useState<ExtendedPlugin[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    setPlugins(pluginApp.getPluginManager().getAllPlugins());
  }, [pluginApp]);

  const handleTogglePlugin = (pluginId: string, enabled: boolean) => {
    try {
      if (enabled) {
        pluginApp.getPluginManager().enablePlugin(pluginId);
      } else {
        pluginApp.getPluginManager().disablePlugin(pluginId);
      }
      setPlugins([...pluginApp.getPluginManager().getAllPlugins()]);
    } catch (error) {
      console.error('Error toggling plugin:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleUninstallPlugin = (pluginId: string) => {
    if (confirm('Are you sure you want to uninstall this plugin?')) {
      try {
        pluginApp.getPluginManager().unregister(pluginId);
        setPlugins([...pluginApp.getPluginManager().getAllPlugins()]);
      } catch (error) {
        console.error('Error uninstalling plugin:', error);
        alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  const filteredPlugins = plugins.filter(plugin => {
    const matchesFilter = filter === 'all' || 
      (filter === 'enabled' && plugin.enabled) || 
      (filter === 'disabled' && !plugin.enabled) ||
      (filter === 'type' && plugin.type === searchTerm);
    
    const matchesSearch = !searchTerm || 
      plugin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (plugin.description && plugin.description.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesFilter && matchesSearch;
  });

  const stats = pluginApp.getStatus();

  return (
    <div className="plugin-manager-ui" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '20px' }}>Plugin Manager</h1>
      
      {/* 统计信息 */}
      <div className="stats" style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '16px', 
        marginBottom: '24px' 
      }}>
        <div style={{ padding: '16px', backgroundColor: '#e3f2fd', borderRadius: '8px', textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 8px 0' }}>Total Plugins</h3>
          <p style={{ margin: '0', fontSize: '24px', fontWeight: 'bold' }}>{stats.totalPlugins}</p>
        </div>
        <div style={{ padding: '16px', backgroundColor: '#e8f5e8', borderRadius: '8px', textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 8px 0' }}>Enabled</h3>
          <p style={{ margin: '0', fontSize: '24px', fontWeight: 'bold' }}>{stats.enabledPlugins}</p>
        </div>
        <div style={{ padding: '16px', backgroundColor: '#fff3e0', borderRadius: '8px', textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 8px 0' }}>Routes</h3>
          <p style={{ margin: '0', fontSize: '24px', fontWeight: 'bold' }}>{stats.routeCount}</p>
        </div>
        <div style={{ padding: '16px', backgroundColor: '#f3e5f5', borderRadius: '8px', textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 8px 0' }}>Components</h3>
          <p style={{ margin: '0', fontSize: '24px', fontWeight: 'bold' }}>{stats.componentCount}</p>
        </div>
      </div>

      {/* 过滤和搜索 */}
      <div className="controls" style={{ 
        display: 'flex', 
        gap: '16px', 
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
        >
          <option value="all">All Plugins</option>
          <option value="enabled">Enabled Only</option>
          <option value="disabled">Disabled Only</option>
        </select>
        
        <input
          type="text"
          placeholder="Search plugins..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ 
            padding: '8px', 
            borderRadius: '4px', 
            border: '1px solid #ddd',
            minWidth: '200px'
          }}
        />
      </div>

      {/* 插件列表 */}
      <div className="plugin-list">
        {filteredPlugins.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            No plugins found matching your criteria.
          </div>
        ) : (
          filteredPlugins.map(plugin => (
            <PluginCard
              key={plugin.id}
              plugin={plugin}
              onToggle={handleTogglePlugin}
              onUninstall={handleUninstallPlugin}
            />
          ))
        )}
      </div>
    </div>
  );
};