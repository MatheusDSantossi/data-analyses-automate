import { Button } from "@progress/kendo-react-buttons";

type CustomButtonProps = {
  onClick?: () => void;
  isDisabled?: boolean;
  children?: React.ReactNode;
};

const CustomButton = ({ onClick, children, isDisabled }: CustomButtonProps) => {
  return (
    <div
      className={`${isDisabled ? "pointer-events-none" : ""} flex items-center justify-center`}
    >
      <div style={{ transform: "none" }}>
        {/* <a href="/dashboard"> */}
        <Button
          onClick={onClick}
          className={`relative inline-block p-px font-semibold leading-6 text-white no-underline ${isDisabled ?"opacity-70": "bg-secondary-dark"} shadow-2xl cursor-pointer group rounded-xl shadow-zinc-900`}
          disabled={isDisabled}
        >
          <span className="absolute inset-0 overflow-hidden rounded-xl">
            <span className="absolute inset-0 rounded-xl bg-[image:radial-gradient(75%_100%_at_50%_0%,rgba(29,111,66,0.6)_0%,rgba(29,111,66,0)_75%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"></span>
          </span>
          <div className="relative z-10 flex items-center px-6 py-3 space-x-2 rounded-xl bg-gray-950/50 ring-1 ring-white/10 ">
            <span>Lets start the magic</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
              data-slot="icon"
              className="w-6 h-6"
            >
              <path
                fillRule="evenodd"
                d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
                clip-rule="evenodd"
              ></path>
            </svg>
          </div>
          <span
            className={`absolute -bottom-0 left-[1.125rem] h-px w-[calc(100%-2.25rem)] bg-gradient-to-r from-emerald-400/0 via-gray-400/90 to-emerald-400/0 transition-opacity duration-500 ${isDisabled ? "" : "group-hover:opacity-40"}`}
          ></span>
        </Button>
        {/* </a> */}
      </div>
    </div>
  );
};

export default CustomButton;
