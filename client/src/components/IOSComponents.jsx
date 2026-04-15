import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

// iOS-style Toast Notification
export const IOSToast = ({ message, type = 'info', isVisible, onClose, duration = 3000 }) => {
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  if (!isVisible) return null;

  const icons = {
    success: <CheckCircle size={20} className="text-green-500" />,
    error: <AlertCircle size={20} className="text-red-500" />,
    warning: <AlertTriangle size={20} className="text-orange-500" />,
    info: <Info size={20} className="text-blue-500" />
  };

  const bgColors = {
    success: 'bg-green-500/10 border-green-500/30',
    error: 'bg-red-500/10 border-red-500/30',
    warning: 'bg-orange-500/10 border-orange-500/30',
    info: 'bg-blue-500/10 border-blue-500/30'
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] animate-ios-slide-down">
      <div className={`
        flex items-center gap-3 px-5 py-3.5
        backdrop-blur-xl bg-black/80 
        rounded-2xl border ${bgColors[type]}
        shadow-2xl shadow-black/50
        min-w-[280px] max-w-[90vw]
      `}>
        {icons[type]}
        <span className="text-white text-sm font-medium flex-1">{message}</span>
        <button 
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded-full transition-colors"
        >
          <X size={16} className="text-gray-400" />
        </button>
      </div>
    </div>
  );
};

// iOS-style Confirmation Modal (Action Sheet style)
export const IOSConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmColor = 'red',
  loading = false 
}) => {
  if (!isOpen) return null;

  const confirmColors = {
    red: 'text-red-500 hover:bg-red-500/10',
    green: 'text-green-500 hover:bg-green-500/10',
    blue: 'text-blue-500 hover:bg-blue-500/10',
    orange: 'text-orange-500 hover:bg-orange-500/10'
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-ios-fade-in"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full sm:w-auto sm:min-w-[320px] sm:max-w-[400px] p-4 animate-ios-slide-up">
        {/* Action Sheet */}
        <div className="bg-[#2c2c2e]/95 backdrop-blur-xl rounded-2xl overflow-hidden mb-2">
          {/* Header */}
          <div className="px-4 py-4 text-center border-b border-white/10">
            <h3 className="text-white font-semibold text-lg">{title}</h3>
            {message && (
              <p className="text-gray-400 text-sm mt-1">{message}</p>
            )}
          </div>
          
          {/* Confirm Button */}
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`
              w-full py-4 text-center font-semibold text-lg
              ${confirmColors[confirmColor]}
              transition-colors disabled:opacity-50
              active:bg-white/5
            `}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Processing...
              </span>
            ) : confirmText}
          </button>
        </div>
        
        {/* Cancel Button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="
            w-full py-4 text-center font-semibold text-lg
            bg-[#2c2c2e]/95 backdrop-blur-xl rounded-2xl
            text-blue-500 hover:bg-white/5
            transition-colors disabled:opacity-50
            active:bg-white/5
          "
        >
          {cancelText}
        </button>
      </div>
    </div>
  );
};

// iOS-style Alert Modal
export const IOSAlert = ({ 
  isOpen, 
  onClose, 
  title, 
  message, 
  buttonText = 'OK',
  type = 'info'
}) => {
  if (!isOpen) return null;

  const icons = {
    success: <CheckCircle size={48} className="text-green-500" />,
    error: <AlertCircle size={48} className="text-red-500" />,
    warning: <AlertTriangle size={48} className="text-orange-500" />,
    info: <Info size={48} className="text-blue-500" />
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-ios-fade-in"
        onClick={onClose}
      />
      
      {/* Alert */}
      <div className="relative bg-[#2c2c2e]/95 backdrop-blur-xl rounded-2xl overflow-hidden min-w-[280px] max-w-[320px] animate-ios-scale-in">
        <div className="px-6 py-6 text-center">
          <div className="flex justify-center mb-4">
            {icons[type]}
          </div>
          <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>
          {message && (
            <p className="text-gray-400 text-sm">{message}</p>
          )}
        </div>
        
        <button
          onClick={onClose}
          className="
            w-full py-4 text-center font-semibold text-lg
            border-t border-white/10
            text-blue-500 hover:bg-white/5
            transition-colors active:bg-white/5
          "
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
};

// iOS-style Segmented Control
export const IOSSegmentedControl = ({ options, value, onChange, className = '' }) => {
  return (
    <div className={`
      inline-flex p-1 bg-[#1c1c1e] rounded-xl
      ${className}
    `}>
      {options.map((option) => (
        <button
          key={option.id}
          onClick={() => onChange(option.id)}
          className={`
            px-4 py-2 rounded-lg text-sm font-medium
            transition-all duration-200
            ${value === option.id 
              ? 'bg-[#3a3a3c] text-white shadow-lg' 
              : 'text-gray-400 hover:text-white'
            }
          `}
        >
          {option.label}
          {option.count !== undefined && (
            <span className={`
              ml-2 px-1.5 py-0.5 rounded-full text-xs
              ${value === option.id ? 'bg-white/20' : 'bg-white/10'}
            `}>
              {option.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
};

// iOS-style Button
export const IOSButton = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
  icon: Icon
}) => {
  const variants = {
    primary: 'bg-blue-500 hover:bg-blue-600 text-white',
    secondary: 'bg-[#3a3a3c] hover:bg-[#4a4a4c] text-white',
    danger: 'bg-red-500 hover:bg-red-600 text-white',
    success: 'bg-green-500 hover:bg-green-600 text-white',
    ghost: 'bg-transparent hover:bg-white/10 text-blue-500',
    destructive: 'bg-transparent hover:bg-red-500/10 text-red-500'
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm rounded-lg',
    md: 'px-4 py-2.5 text-sm rounded-xl',
    lg: 'px-6 py-3.5 text-base rounded-xl'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2
        font-semibold transition-all duration-200
        active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : Icon && (
        <Icon size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />
      )}
      {children}
    </button>
  );
};

// iOS-style Card
export const IOSCard = ({ children, className = '', onClick }) => {
  return (
    <div 
      onClick={onClick}
      className={`
        bg-[#1c1c1e] rounded-2xl overflow-hidden
        ${onClick ? 'cursor-pointer hover:bg-[#2c2c2e] active:scale-[0.98]' : ''}
        transition-all duration-200
        ${className}
      `}
    >
      {children}
    </div>
  );
};

// iOS-style List Item
export const IOSListItem = ({ 
  title, 
  subtitle, 
  value, 
  valueColor = 'text-gray-400',
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  onClick,
  showDivider = true,
  action
}) => {
  return (
    <div 
      onClick={onClick}
      className={`
        flex items-center gap-3 px-4 py-3
        ${onClick ? 'cursor-pointer hover:bg-white/5 active:bg-white/10' : ''}
        ${showDivider ? 'border-b border-white/5' : ''}
        transition-colors
      `}
    >
      {LeftIcon && (
        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
          <LeftIcon size={18} className="text-gray-400" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-white font-medium truncate">{title}</div>
        {subtitle && (
          <div className="text-gray-500 text-sm truncate">{subtitle}</div>
        )}
      </div>
      {value && (
        <div className={`font-medium ${valueColor}`}>{value}</div>
      )}
      {action}
      {RightIcon && (
        <RightIcon size={18} className="text-gray-500" />
      )}
    </div>
  );
};

// Hook for managing toast notifications
export const useIOSToast = () => {
  const [toast, setToast] = useState({ isVisible: false, message: '', type: 'info' });

  const showToast = (message, type = 'info') => {
    setToast({ isVisible: true, message, type });
  };

  const hideToast = () => {
    setToast(prev => ({ ...prev, isVisible: false }));
  };

  return { toast, showToast, hideToast };
};

// Hook for managing confirmation modals
export const useIOSConfirm = () => {
  const [confirm, setConfirm] = useState({ 
    isOpen: false, 
    title: '', 
    message: '', 
    onConfirm: () => {},
    confirmText: 'Confirm',
    confirmColor: 'red'
  });

  const showConfirm = ({ title, message, onConfirm, confirmText = 'Confirm', confirmColor = 'red' }) => {
    setConfirm({ isOpen: true, title, message, onConfirm, confirmText, confirmColor });
  };

  const hideConfirm = () => {
    setConfirm(prev => ({ ...prev, isOpen: false }));
  };

  return { confirm, showConfirm, hideConfirm };
};

export default {
  IOSToast,
  IOSConfirmModal,
  IOSAlert,
  IOSSegmentedControl,
  IOSButton,
  IOSCard,
  IOSListItem,
  useIOSToast,
  useIOSConfirm
};
