import type React from "react";
import { IoCloseSharp } from "react-icons/io5";

interface CloseButtonProps {
  buttonContent: string;
  buttonIcon?: React.ReactNode;
  onClick: () => void;
}

const CloseButton = ({ buttonContent, buttonIcon, onClick }: CloseButtonProps) => {
  return (
    <a
      onClick={onClick}
      className="relative inline-flex items-center justify-start py-3 pl-4 pr-12 overflow-hidden cursor-pointer font-semibold text-primary transition-all duration-150 ease-in-out rounded hover:pl-10 hover:pr-6 bg-gray-50 group"
    >
      <span className="absolute bottom-0 left-0 w-full h-1 transition-all duration-150 ease-in-out bg-tertiary group-hover:h-full"></span>
      <span className="absolute right-0 pr-4 duration-200 ease-out group-hover:translate-x-12">
        {buttonIcon ? (
          <div className="w-6 h-6 text-secondary-dark">{buttonIcon}</div>
        ) : (
          <IoCloseSharp className="w-6 h-6 text-secondary-dark" />
        )}
      </span>
      <span className="absolute left-0 pl-2.5 -translate-x-12 group-hover:translate-x-0 ease-out duration-200">
        {buttonIcon ? (
          <div className="w-6 h-6 text-secondary-dark">{buttonIcon}</div>
        ) : (
          <IoCloseSharp className="w-6 h-6 text-secondary-dark" />
        )}
      </span>
      <span className="relative w-full text-left transition-colors duration-200 ease-in-out group-hover:text-white">
        {buttonContent}
      </span>
    </a>
  );
};

export default CloseButton;
