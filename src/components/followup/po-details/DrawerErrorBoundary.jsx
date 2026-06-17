import React from 'react';

/**
 * Catches render-time errors inside the PO drawer so a single broken
 * section doesn't blank the whole panel.
 */
export default class DrawerErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('PO drawer render error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="px-5 py-4 border-b border-[#E5E5E5] bg-red-50">
          <div className="text-[12px] font-semibold text-red-600 mb-1">Something didn't render</div>
          <div className="text-[11px] text-red-500 leading-snug break-words">
            {String(this.state.error?.message || this.state.error)}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}