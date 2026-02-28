import {type NavigationItem} from '../navigation/navigation';
import {Divider} from '@mui/material';

import {MainSidebarDrawerHeader} from './MainSidebarDrawerHeader';
import {NavigationList} from '../navigation/NavigationList';

interface MainSidebarMenuSectionProps {
  handleDrawerToggle: () => void;
  handleItemClick: (
    event: any,
    segment: string | undefined,
    hasChildren: boolean,
  ) => void;
  layoutType: 'type-a' | 'type-b';
  NAVIGATION: NavigationItem[];
  isMobile: boolean;
  pathname: string;
  openItems: Record<string, boolean>;
}

export function MainSidebarMenuSection({
  handleDrawerToggle,
  handleItemClick,
  layoutType,
  NAVIGATION,
  isMobile,
  pathname,
  openItems,
}: MainSidebarMenuSectionProps) {
  return (
    <div>
      <MainSidebarDrawerHeader handleDrawerToggle={handleDrawerToggle} />
      {layoutType === 'type-a' && <Divider />}
      {layoutType === 'type-b' && <div className="mt-2" />}
      <NavigationList
        NAVIGATION={NAVIGATION}
        isMobile={isMobile}
        pathname={pathname}
        openItems={openItems}
        handleItemClick={handleItemClick}
      />
    </div>
  );
}
