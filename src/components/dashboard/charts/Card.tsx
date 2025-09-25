import {
  Card,
  CardTitle,
  CardBody,
  CardActions,
} from "@progress/kendo-react-layout";

interface CardProps {
  title: string;
  content: React.ReactNode | string;
  footer?: React.ReactNode | string;
  buttons?: React.ReactNode;
}

const CardDashboard = ({
  title,
  content,
  buttons = null,
  footer = null,
}: CardProps) => {
  return (
    <div className="flex justify-center p-2">
      <Card>
        <CardBody className="bg-white text-black p-2 w-fit rounded shadow-md">
          <CardTitle>{title}</CardTitle>
          {typeof content === "string" ? (
            <div>
              <p>{content}</p>
            </div>
          ) : (
            <div>{content}</div>
          )}
          {buttons && <CardActions>{buttons}</CardActions>}
          {footer && <div className="mt-4 border-t pt-2">{footer}</div>}
        </CardBody>
      </Card>
    </div>
  );
};

export default CardDashboard;
